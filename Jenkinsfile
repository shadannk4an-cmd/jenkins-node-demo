pipeline {

    agent any

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

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                script {
                    docker.image('node:24-alpine').inside {
                        sh 'npm test'
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build \
                    -t jenkins-node-demo:${BUILD_NUMBER} .
                '''
            }
        }

        stage('Login to ECR') {
            steps {
                sh '''
                    aws ecr get-login-password \
                    --region ${AWS_REGION} |
                    docker login \
                    --username AWS \
                    --password-stdin ${ECR_REGISTRY}
                '''
            }
        }

        stage('Tag Docker Image') {
            steps {
                sh '''
                    docker tag \
                    jenkins-node-demo:${BUILD_NUMBER} \
                    ${ECR_REPOSITORY}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Push Docker Image') {
            steps {
                sh '''
                    docker push \
                    ${ECR_REPOSITORY}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Read Last Good Image') {
            steps {
                script {

                    env.PREVIOUS_IMAGE = sh(
                        script: """
                            ssh \
                            -i ${SSH_KEY} \
                            ubuntu@${APP_SERVER_IP} \
                            "sudo cat /opt/jenkins-node-demo/last_good_image 2>/dev/null || true"
                        """,
                        returnStdout: true
                    ).trim()

                    if (env.PREVIOUS_IMAGE?.trim()) {
                        echo "Last known good image: ${env.PREVIOUS_IMAGE}"
                    } else {
                        echo 'No last-known-good image recorded yet.'
                    }
                }
            }
        }

        stage('Deploy to App Server') {
            steps {
                sh '''
                    ssh \
                    -i ${SSH_KEY} \
                    ubuntu@${APP_SERVER_IP} \
                    "
                    aws ecr get-login-password \
                    --region ${AWS_REGION} |
                    sudo docker login \
                    --username AWS \
                    --password-stdin ${ECR_REGISTRY}

                    sudo docker pull \
                    ${ECR_REPOSITORY}:${BUILD_NUMBER}

                    sudo docker rm \
                    -f jenkins-node-app || true

                    sudo docker run \
                    -d \
                    --name jenkins-node-app \
                    -p 3000:3000 \
                    ${ECR_REPOSITORY}:${BUILD_NUMBER}
                    "
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                script {

                    def healthStatus = sh(
                        script: '''
                            ssh \
                            -i ${SSH_KEY} \
                            ubuntu@${APP_SERVER_IP} \
                            "
                            echo 'Waiting for application to become ready...'

                            for i in 1 2 3 4 5 6; do

                                if curl -f http://localhost:3000/health; then
                                    echo 'Application is healthy'
                                    exit 0
                                fi

                                echo 'Application not ready yet. Retrying in 5 seconds...'
                                sleep 5

                            done

                            echo 'Application failed health check'
                            exit 1
                            "
                        ''',
                        returnStatus: true
                    )

                    if (healthStatus != 0) {

                        echo 'Health check failed.'

                        if (env.PREVIOUS_IMAGE?.trim()) {

                            echo "Starting rollback to ${env.PREVIOUS_IMAGE}"

                            sh '''
                                ssh \
                                -i ${SSH_KEY} \
                                ubuntu@${APP_SERVER_IP} \
                                "
                                echo 'Removing failed container...'

                                sudo docker rm \
                                -f jenkins-node-app || true

                                echo 'Pulling last known good image...'

                                sudo docker pull \
                                ${PREVIOUS_IMAGE}

                                echo 'Starting last known good image...'

                                sudo docker run \
                                -d \
                                --name jenkins-node-app \
                                -p 3000:3000 \
                                ${PREVIOUS_IMAGE}

                                echo 'Waiting for rollback version...'
                                sleep 5

                                echo 'Verifying rollback...'

                                curl -f http://localhost:3000/health

                                echo 'ROLLBACK SUCCESSFUL'
                                "
                            '''

                            error('New deployment failed. Automatic rollback succeeded.')
                        }

                        error('New deployment failed. No last-known-good image exists yet.')
                    }

                    echo 'New deployment verified successfully.'
                }
            }
        }

        stage('Mark Image as Last Good') {
            steps {
                sh '''
                    ssh \
                    -i ${SSH_KEY} \
                    ubuntu@${APP_SERVER_IP} \
                    "
                    sudo mkdir -p /opt/jenkins-node-demo

                    echo '${ECR_REPOSITORY}:${BUILD_NUMBER}' |
                    sudo tee /opt/jenkins-node-demo/last_good_image \
                    > /dev/null

                    echo 'Saved last-known-good image:'
                    sudo cat /opt/jenkins-node-demo/last_good_image
                    "
                '''
            }
        }
    }

    post {

        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check deployment and rollback logs.'
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}