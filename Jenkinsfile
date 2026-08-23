pipeline {
    agent {
        docker {
            image 'node:24-alpine'
        }
    }

    stages {
        stage('Verify Environment') {
            steps {
                sh 'node --version'
                sh 'npm --version'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
    }
}
