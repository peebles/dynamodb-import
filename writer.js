'use strict';
let async = require( 'async' );
let consign = require( 'consign' );
let rateLimit = require('function-rate-limit');

let ddb;

// --table --kafka --aws-access-key --aws-access-secret --concurrency (4) --batch-write (25)

function exit( err ) {
  if ( err ) console.trace( err );
  process.exit( err ? 1 : 0 );
}

let app = {};
consign().include( 'lib' ).into( app );
application();

function application() {

  let args = {
    table: process.env.TABLE,
    kafka: process.env.KAFKA,
    'aws-access-key': process.env.AWS_ACCESS_KEY,
    'aws-access-secret': process.env.AWS_ACCESS_SECRET,
    'ddb-endpoint': process.env.DDB_ENDPOINT,
    'write-capacity': process.env.WRITE_CAPACITY,
  };
  
  if ( ! args.table ) {
    exit( new Error( 'Missing required table name argument!' ) );
  }

  if ( ! ( args[ 'aws-access-key' ] && args[ 'aws-access-secret' ] ) ) {
    exit( new Error( 'Missing required AWS access key and/or secret' ) );
  }

  if ( ! args[ 'kafka' ] ) {
    exit( new Error( 'Missing required kafka:port' ) );
  }

  if ( ! args[ 'ddb-endpoint' ] ) {
    exit( new Error( 'Missing required ddb-endpoint' ) );
  }

  let Q = require( 'kafka-queue' )({
    keyField: 'cameraId',
    connectionString: args.kafka,
    logger: {
      logLevel: 1
    }
  });

  ddb = require('dynamodb').ddb({
    accessKeyId: args[ 'aws-access-key' ],
    secretAccessKey: args[ 'aws-access-secret' ],
    endpoint: args[ 'ddb-endpoint' ]
  });

  let perSec = ( args[ 'write-capacity' ] ? Number( args[ 'write-capacity' ] ) : 5 );
  
  let putItem = rateLimit( perSec, 1000, function( item, cb ) {
    ddb.putItem( args.table, item, {}, cb );
  });

  let total = 0;

  Q.consumer.connect( args.table, 'ddbimport', function( message, cb ) {
    let handle = message.handle;
    let msg = message.msg;
    Object.keys( msg ).forEach( function( k ) {
      if ( typeof msg[k] == 'object' && !Array.isArray(msg[k]) )
	msg[k] = JSON.stringify( msg[k] );
    });
    putItem( msg, function( err ) {
      if ( err ) {
	console.log( err );
	cb( err );
      }
      else {
	// console.log( 'put:', msg );
	total += 1;
	if ( ( total % 10000 ) == 0 ) {
	  console.log( 'lifetime writes:', total );
	}
	cb();
      }
    });
  });
  
}
