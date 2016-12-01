# Fast DynamoDB Import

Exporting tables from AWS DynamoDB to S3 is very fast, but importing them is super slow!  If you've
found this project you know.

Using this project, you can import at whatever write capacity you've programmed your DynamboDB table to.

## Quick Start

### Export your table into S3

Read [this](http://docs.aws.amazon.com/datapipeline/latest/DeveloperGuide/dp-importexport-ddb-part2.html)

### Download this data to here

```bash
mkdir data
aws --profile <yours> s3 sync s3://<bucket>/path $(pwd)/data
```

### Create an AWS EC2 machine

```bash
./create-vm.sh -p <your-aws-profile> -h <hostname> [-s security_group] [-v vpcid] [-i instance-type]
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
10 partitions are created, meaning you can run UP TO 10 instances of the "writer" we'll discuss in a minute.

### Edit the docker-compose.yml file.

Edit the "environment" section for your needs.  `TABLE`	should be the name of the table you are importing.
Set `CONFIG` to "./config-kafka.json".
The `AWS_ACCESS_*` variables should be set to your account creds.  `DDB_ENDPOINT` should be set to yours.  Seems
like it needs to be "dynamodb.<your-region>.amazonaws.com" ... and by <your-region> I mean the region your
dynambodb table exists.

`WRITE_CAPACITY` should be set to the number of writes per second you have allocated to your ddb table you are
importing.  The "writer" instance will try to get as close to that many writes per second that it can.

### Edit config-kafka.json

"connectionString" should be set to the IP address of the docker machine you launched, with a ":9092" after it.
"keyField" should be set to the name of the ddb hash key field in the table you are importing.

### Fire the writer

```bash
docker-compose build
docker-compose up -d
```

The writer is a Kafka consumer and will consume the kafka queue that is being written by the importer (next step)
and write the ddb records.

### Run the importer

```bash
node importer.js --manifest data/manifest --table <name-of-table-to-import> --config ./config-kafka.json
```

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

Well ... maybe.  Depends on how distributed is the hash key space in your table import data.  Kafka will keep a particular hash key
to a single consumer.  If all of your import data contains records with an identical hash key, then even through you run 2 (or more)
instances of the writer, only one writer will be consuming those records and writing them.  So basically, the fewer unique hash key
values, the bigger you want WRITE_CAPACITY to be and to run fewer instances of the writer.  More unique hash key values, perhaps smaller
WRITE_CAPACITY per writer instance, but more instances.

Experimentally I've found that running more than about 250 ddb writes per second on a single t2.medium instance starts to generate
EAI_AGAIN errors (dns lookup failures) and even though I have a write capacity of 400-500, I just can't do better than about 250/sec.
However, if I launch a second t2.medium and run 200/sec on each ec2 machine, I can sustain 400/sec without errors.

## RabbitMQ

So if your hash key space is pretty sparse you might want to use RabbitMQ instead.

Edit config-rabbit.json and change "url", using the IP address of the docker machine.  Then:

```bash
sh ./launch-rabbit.sh
```

Edit docker-compose.yml and change `CONFIG` to "./config-rabbit.json".  Launch the writer:

```bash
docker-compose build
docker-compose up -d
```

And run the importer like this:

```bash
node importer.js --manifest data/manifest --table <name-of-table-to-import> --config ./config-rabbit.json
```

