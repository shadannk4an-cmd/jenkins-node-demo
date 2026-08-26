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
                sh '''
                    ssh \
                    -i ${SSH_KEY} \
                    ubuntu@${APP_SERVER_IP} \
                    "curl -f http://localhost:3000"
                '''
            }
        }
    }
}
