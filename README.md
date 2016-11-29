# Fast DynamoDB Import

Exporting tables from AWS DynamoDB to S3 is very fast, but importing them is super slow!  If you've
found this project you know.

## Quick Start

### Export your table into S3

Read [this](http://docs.aws.amazon.com/datapipeline/latest/DeveloperGuide/dp-importexport-ddb-part2.html)

### Download this data to here

```bash
mkdir data
aws --profile <yours> s3 sync s3://<bucket>/path $(pwd)/data
```

### Create an AWS Ec2 machine

```bash
./create-vm.sh -p <yours> -h <hostname> [-s security_group] [-v vpcid] [-i instance-type]
```

Edit the security group for this machine after its running.  Add an inbound rule: TCP port 9092 from ANYWHERE.

### Set your environment

```bash
eval $(docker-machine env <hostname>)
```

Same `<hostname>` you named the machine when you created it.

### Launch Kafka on that machine

```bash
sh ./launch-kafka.sh <name-of-table-to-import>
```

Pass it one argument, the name of the table you are importing.  This table name will be the Kafka topic name.
10 partitions are created, meaning you can run UP TO 10 instances of the "writer" we'll disucess in a minute.

### Edit the docker-compose.yml file.

Edit the "environment" section for your needs.  `TABLE`	should be the name of the table you are importing.
`KAFKA` should be set to the IP address of the docker machine you launched, with a ":9092" after it.  The
`AWS_ACCESS_*` variables should be set to your account creds.  `DDB_ENDPOINT` should be set to yours.  Seems
like it needs to be "dynamodb.<your-region>.amazonaws.com" ... and by <your-region> I mean the region your
dynambodb table exists.

`WRITE_CAPACITY` should be set to the number of writes per second you have allocated to your ddb table you are
importing.  The "writer" instance will try to get as close to that many writes per second that it can.

### Fire the writer

```bash
docker-compose build
docker-compose up -d
```

The writer is a Kafka consumer and will consume the kafka queue that is being written by the importer (next step)
and write the ddb records.

### Run the importer

```bash
node importer.js --manifest data/manifest --table <name-of-table-to-import> --kafka <kafka-endpoint> --key-field <hash-key-field-name>
```

For `kafka-endpoint` use the same value you editted in the docker-compose.yml file.  The `hash-key-field-name` should be the name
of the field you use for the ddb hash key.  Kafka needs this for partitioning.

At this point, the exported ddb table data from the S3 files you downloaded are being written to a Kafka queue.  The "writer" script
is running in AWS and is consuming the Kafka queue and writing the table data into ddb.  Its writing WRITE_CAPACITY records per second.

## Scaling

So lets say you configured your ddb table, the one you are going to import, to say 50 writes per second.  And you set WRITE_CAPACITY
in docker-compose.yml to 50.  If you examine the metrics in AWS console you should see your writes very close to the threshold of 50.
Already this is way better than the AWS published method of importing!  But you can do better!  Just use the AWS console to change
your table's write capacity to 100 ... you can do this while the import is running.  Once that is done, then

```bash
docker-compose scale writer=2
```

and another instances of the writer will start, which is going to write another 50 records per second, so now you're going at 100
per second total.  See the AWS ddb metrics to confirm.

And you can keep upping this, so long as you do it with multiple of WRITE_CAPACITY, and as long as you do not exceed 10 instances
of the writer ... because in "launch-kafka.sh" we hardcoded the number of partitions to 10.



