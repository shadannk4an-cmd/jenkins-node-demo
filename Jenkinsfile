pipeline {

    agent any

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REGISTRY = '665910433244.dkr.ecr.us-east-1.amazonaws.com'
        ECR_REPOSITORY = '665910433244.dkr.ecr.us-east-1.amazonaws.com/jenkins-node-demo'
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
                sh 'docker build -t jenkins-node-demo:${BUILD_NUMBER} .'
            }
        }

        stage('Login to ECR') {
            steps {
                sh '''
                    aws ecr get-login-password --region ${AWS_REGION} |
                    docker login --username AWS --password-stdin ${ECR_REGISTRY}
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
                sh 'docker push ${ECR_REPOSITORY}:${BUILD_NUMBER}'
            }
        }
    }
}
