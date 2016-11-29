'use strict';
let path = require( 'path' );
module.exports = function( app ) {
  return function( manifest, cb ) {
    try {
      require( 'fs' ).readFile( manifest, 'utf8', function( err, data ) {
	if ( err ) return cb( err );
	let json = JSON.parse( data );
	let filenames = json.entries.map( function( entry ) {
	  let filename = path.basename( entry.url );
	  return path.join( path.dirname( manifest ), filename );
	});
	cb( null, filenames );
      });
    } catch( err ) {
      cb( err );
    }
  };
};
