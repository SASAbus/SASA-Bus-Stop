pipeline {
  agent any
  stages {
    stage('configure'){
	steps{
	  sh "sed -i '/<\\/html>/e cat ${GOOGLE_ANALYTICS}' public/index.html"
	}
    }
    stage('upload') {
      steps {
	sh 'test -f public/index.html'
        s3Upload(bucket: 'today.noi.bz.it', acl: 'PublicRead', file: './public')
      }
    }
  }
   environment {
     AWS_ACCESS_KEY_ID = credentials('AWS_ACCESS_KEY_ID')
     AWS_SECRET_ACCESS_KEY = credentials('AWS_SECRET_ACCESS_KEY')
     GOOGLE_ANALYTICS = credentials('noi-display-ga')
   }
}
