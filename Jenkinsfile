pipeline {

    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
    }

    environment {
        AWS_REGION = 'us-east-1'

        ECR_REGISTRY =
            '665910433244.dkr.ecr.us-east-1.amazonaws.com'

        ECR_REPOSITORY =
            '665910433244.dkr.ecr.us-east-1.amazonaws.com/jenkins-node-demo'

        APP_SERVER_IP = '172.31.45.105'

        SSH_KEY =
            '/var/lib/jenkins/.ssh/id_ed25519'

        PREVIOUS_IMAGE = ''
    }

    stages {

        // ============================================================
        // 1. CHECKOUT
        // ============================================================

        stage('Checkout') {
            steps {
                checkout scm
            }
        }


        // ============================================================
        // 2. TEST
        // ============================================================

        stage('Test') {
            steps {
                script {
                    docker.image('node:24-alpine').inside {
                        sh 'npm test'
                    }
                }
            }
        }


        // ============================================================
        // 3. BUILD DOCKER IMAGE
        // ============================================================

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build \
                    -t jenkins-node-demo:${BUILD_NUMBER} .
                '''
            }
        }


        // ============================================================
        // 4. LOGIN TO ECR
        // ============================================================

        stage('Login to ECR') {
            options {
                timeout(time: 2, unit: 'MINUTES')
            }

            steps {
                retry(3) {

                    sh '''
                        rm -f /tmp/ecr-password-${BUILD_NUMBER}

                        aws ecr get-login-password \
                        --region ${AWS_REGION} \
                        > /tmp/ecr-password-${BUILD_NUMBER}

                        if [ ! -s /tmp/ecr-password-${BUILD_NUMBER} ]; then
                            echo "ECR password file is empty"
                            exit 1
                        fi
                    '''

                    sh '''
                        docker logout ${ECR_REGISTRY} \
                        > /dev/null 2>&1 || true

                        docker login \
                        --username AWS \
                        --password-stdin ${ECR_REGISTRY} \
                        < /tmp/ecr-password-${BUILD_NUMBER}
                    '''

                    sh '''
                        rm -f /tmp/ecr-password-${BUILD_NUMBER}
                    '''
                }
            }
        }


        // ============================================================
        // 5. TAG IMAGE
        // ============================================================

        stage('Tag Docker Image') {
            steps {
                sh '''
                    docker tag \
                    jenkins-node-demo:${BUILD_NUMBER} \
                    ${ECR_REPOSITORY}:${BUILD_NUMBER}
                '''
            }
        }


        // ============================================================
        // 6. PUSH IMAGE TO ECR
        // ============================================================

        stage('Push Docker Image') {
            steps {
                retry(3) {
                    sh '''
                        docker push \
                        ${ECR_REPOSITORY}:${BUILD_NUMBER}
                    '''
                }
            }
        }


        // ============================================================
        // 7. READ LAST KNOWN GOOD IMAGE
        // ============================================================

        stage('Read Last Good Image') {
            steps {
                script {

                    env.PREVIOUS_IMAGE = sh(
                        script: """
                            ssh \
                            -o BatchMode=yes \
                            -o ConnectTimeout=10 \
                            -i ${SSH_KEY} \
                            ubuntu@${APP_SERVER_IP} \
                            "sudo cat /opt/jenkins-node-demo/last_good_image 2>/dev/null || true"
                        """,
                        returnStdout: true
                    ).trim()

                    if (env.PREVIOUS_IMAGE?.trim()) {

                        echo "Last known good image:"
                        echo "${env.PREVIOUS_IMAGE}"

                    } else {

                        echo "No last-known-good image recorded yet."
                    }
                }
            }
        }


        // ============================================================
        // 8. DEPLOY NEW IMAGE
        // ============================================================

        stage('Deploy to App Server') {

            options {
                timeout(time: 5, unit: 'MINUTES')
            }

            steps {

                retry(2) {

                    sh '''
                        ssh \
                        -o BatchMode=yes \
                        -o ConnectTimeout=10 \
                        -i ${SSH_KEY} \
                        ubuntu@${APP_SERVER_IP} \
                        "
                        set -e

                        echo 'Getting ECR login password...'

                        rm -f /tmp/app-ecr-password

                        aws ecr get-login-password \
                        --region ${AWS_REGION} \
                        > /tmp/app-ecr-password

                        if [ ! -s /tmp/app-ecr-password ]; then
                            echo 'ECR password file is empty'
                            exit 1
                        fi

                        echo 'Logging Docker into ECR...'

                        sudo docker login \
                        --username AWS \
                        --password-stdin ${ECR_REGISTRY} \
                        < /tmp/app-ecr-password

                        rm -f /tmp/app-ecr-password

                        echo 'Pulling new image...'

                        sudo docker pull \
                        ${ECR_REPOSITORY}:${BUILD_NUMBER}

                        echo 'Removing old container...'

                        sudo docker rm \
                        -f jenkins-node-app || true

                        echo 'Starting new container...'

                        sudo docker run \
                        -d \
                        --name jenkins-node-app \
                        -p 3000:3000 \
                        ${ECR_REPOSITORY}:${BUILD_NUMBER}

                        echo 'New container started.'
                        "
                    '''
                }
            }
        }


        // ============================================================
        // 9. VERIFY NEW DEPLOYMENT
        // ============================================================

        stage('Verify Deployment') {

            steps {

                script {

                    def healthStatus = sh(
                        script: '''
                            ssh \
                            -o BatchMode=yes \
                            -o ConnectTimeout=10 \
                            -i ${SSH_KEY} \
                            ubuntu@${APP_SERVER_IP} \
                            "
                            echo 'Checking new deployment...'

                            for i in 1 2 3 4 5 6
                            do

                                if curl \
                                --fail \
                                --silent \
                                --show-error \
                                --max-time 3 \
                                http://localhost:3000/health
                                then

                                    echo
                                    echo 'Application is healthy.'
                                    exit 0

                                fi

                                echo
                                echo 'Application not ready yet.'
                                echo 'Retrying in 5 seconds...'

                                sleep 5

                            done

                            echo
                            echo 'NEW APPLICATION FAILED HEALTH CHECK.'

                            exit 1
                            "
                        ''',
                        returnStatus: true
                    )


                    // ==================================================
                    // NEW DEPLOYMENT FAILED
                    // ==================================================

                    if (healthStatus != 0) {

                        echo '========================================'
                        echo 'NEW DEPLOYMENT FAILED'
                        echo '========================================'


                        // ==============================================
                        // CHECK WHETHER A PREVIOUS IMAGE EXISTS
                        // ==============================================

                        if (env.PREVIOUS_IMAGE?.trim()) {

                            echo "ROLLING BACK TO:"
                            echo "${env.PREVIOUS_IMAGE}"


                            // ==========================================
                            // AUTOMATIC ROLLBACK
                            // ==========================================

                            def rollbackStatus = sh(
                                script: '''
                                    ssh \
                                    -o BatchMode=yes \
                                    -o ConnectTimeout=10 \
                                    -i ${SSH_KEY} \
                                    ubuntu@${APP_SERVER_IP} \
                                    "
                                    set -e

                                    echo 'Removing failed container...'

                                    sudo docker rm \
                                    -f jenkins-node-app || true


                                    echo 'Getting ECR credentials...'

                                    rm -f /tmp/rollback-ecr-password

                                    aws ecr get-login-password \
                                    --region ${AWS_REGION} \
                                    > /tmp/rollback-ecr-password


                                    if [ ! -s /tmp/rollback-ecr-password ]; then
                                        echo 'Could not get ECR password'
                                        exit 1
                                    fi


                                    echo 'Logging Docker into ECR...'

                                    sudo docker login \
                                    --username AWS \
                                    --password-stdin ${ECR_REGISTRY} \
                                    < /tmp/rollback-ecr-password

                                    rm -f /tmp/rollback-ecr-password


                                    echo 'Pulling last known good image...'

                                    sudo docker pull \
                                    ${PREVIOUS_IMAGE}


                                    echo 'Starting last known good image...'

                                    sudo docker run \
                                    -d \
                                    --name jenkins-node-app \
                                    -p 3000:3000 \
                                    ${PREVIOUS_IMAGE}


                                    echo 'Checking rollback application...'


                                    for i in 1 2 3 4 5 6
                                    do

                                        if curl \
                                        --fail \
                                        --silent \
                                        --show-error \
                                        --max-time 3 \
                                        http://localhost:3000/health
                                        then

                                            echo
                                            echo '========================================'
                                            echo 'ROLLBACK SUCCESSFUL'
                                            echo '========================================'

                                            exit 0

                                        fi

                                        echo
                                        echo 'Rollback application not ready yet.'
                                        echo 'Retrying in 5 seconds...'

                                        sleep 5

                                    done


                                    echo
                                    echo '========================================'
                                    echo 'ROLLBACK FAILED'
                                    echo '========================================'

                                    exit 1
                                    "
                                ''',
                                returnStatus: true
                            )


                            if (rollbackStatus == 0) {

                                error(
                                    'New deployment failed, but automatic rollback succeeded.'
                                )

                            } else {

                                error(
                                    'New deployment failed AND automatic rollback failed.'
                                )
                            }


                        } else {

                            error(
                                'New deployment failed and no last-known-good image exists.'
                            )
                        }
                    }


                    echo '========================================'
                    echo 'NEW DEPLOYMENT HEALTH CHECK PASSED'
                    echo '========================================'
                }
            }
        }


        // ============================================================
        // 10. SAVE SUCCESSFUL IMAGE AUTOMATICALLY
        // ============================================================

        stage('Mark Image as Last Good') {

            steps {

                sh '''
                    ssh \
                    -o BatchMode=yes \
                    -o ConnectTimeout=10 \
                    -i ${SSH_KEY} \
                    ubuntu@${APP_SERVER_IP} \
                    "
                    set -e

                    sudo mkdir -p /opt/jenkins-node-demo

                    echo '${ECR_REPOSITORY}:${BUILD_NUMBER}' |
                    sudo tee \
                    /opt/jenkins-node-demo/last_good_image \
                    > /dev/null

                    echo '========================================'
                    echo 'LAST KNOWN GOOD IMAGE'
                    echo '========================================'

                    sudo cat \
                    /opt/jenkins-node-demo/last_good_image
                    "
                '''
            }
        }
    }


    // ================================================================
    // POST ACTIONS
    // ================================================================

    post {

        success {

            echo '========================================'
            echo 'PIPELINE SUCCESSFUL'
            echo '========================================'

            echo "Healthy image: ${ECR_REPOSITORY}:${BUILD_NUMBER}"
        }

        failure {

            echo '========================================'
            echo 'PIPELINE FAILED'
            echo '========================================'

            echo 'Check deployment and rollback logs.'
        }

        always {

            sh '''
                rm -f \
                /tmp/ecr-password-${BUILD_NUMBER} \
                || true
            '''

            echo 'Pipeline execution finished.'
        }
    }
}