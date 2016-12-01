#!/bin/sh
docker run -d --name rabbitmq -e RABBITMQ_DEFAULT_USER=admin -e RABBITMQ_DEFAULT_PASS=secret --publish 5672:5672 rabbitmq 
