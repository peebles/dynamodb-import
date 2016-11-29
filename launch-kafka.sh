#!/bin/sh
TOPIC="$1"
if [ -z "$TOPIC" ]; then
    echo "Must supply the DDB table name as a topic name for Kafka"
    exit 1
fi
docker run -d --name zookeeper -p 2181:2181 jplock/zookeeper:3.4.6
MACHINE_IP=$(basename $DOCKER_HOST|awk -F: '{print $1}')
docker run -d --name kafka --link zookeeper:zookeeper --env KAFKA_ADVERTISED_HOST_NAME=$MACHINE_IP --publish 9092:9092 ches/kafka

echo "waiting 5 seconds for brokers to come up ..."
sleep 5

# JMX_PORT= to avoid a port conflict exception when using the running container.
docker exec -it kafka env JMX_PORT= kafka-topics.sh --create --topic $TOPIC --replication-factor 1 --partitions 10 --zookeeper zookeeper:2181
