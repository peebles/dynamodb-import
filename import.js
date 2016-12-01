'use strict';
let async = require( 'async' );
let consign = require( 'consign' );
let byline = require( 'byline' );

// --table --manifest --config

function exit( err ) {
  if ( err ) console.trace( err );
  process.exit( err ? 1 : 0 );
}

let app = {};
consign().include( 'lib' ).into( app );
application();

function application() {
  process.argv.shift();
  process.argv.shift();
  let args = app.lib.parseargs( process.argv );

  if ( ! ( args.manifest && args.table ) ) {
    exit( new Error( 'Missing required manifest and table name arguments!' ) );
  }

  if ( ! args[ 'config' ] ) {
    exit( new Error( 'Missing required config' ) );
  }

  let config = require( args.config );
  
  let Q = require( 'cloud-queue2' )( config );
  
  let total = 0;
  Q.producer.connect( function( err ) {
    if ( err ) exit( err );
    app.lib.getfiles( args.manifest, function( err, files ) {
      if ( err ) exit( err );
      async.each( files, function( file, cb ) {
	let stream = require( 'fs' ).createReadStream( file );
	stream = byline.createStream( stream );

	// create a writer that can back-pressure the readers
	// so we don't run out of memory!
	var Writable = require('stream').Writable;
	var ws = Writable();
	ws._write = function (chunk, enc, next) {
	  let line = chunk.toString();
	  let item = app.lib.objfromddb(JSON.parse( line ));
	  Q.producer.send( args.table, item, function( err ) {
	    if ( err ) { console.log( err ); return next( err ); }
	    total += 1;
	    if ( ( total % 1000 ) == 0 ) console.log( 'subtotal:', total );
	    next();
	  });
	};
	stream.pipe( ws );
	ws.on( 'finish', function() {
	  cb();
	});
      }, function( err ) {
	console.log( total );
	exit( err );
      });
    });
  });
}
