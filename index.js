var http = require( 'http' );
var async = require( 'async' );
var express = require( 'express' );
var bodyParser = require('body-parser');
var app = express();
var cacheTimeout = 1000 * 60 * 60 * 6; //6 Hours
var cache = {};

function loadVersion( packageName, cb ) {
	var result = '',
		data = null;

	http.get( 'http://registry.npmjs.org/' + packageName, function( response ){
		
		response.on( 'data', function( chunk ){
			result += chunk;
		});

		response.on( 'end', function(){
			try {
				data = JSON.parse( result );
			} catch( e ) {
				cb( null );
			}

			if( data ) {
				cb( data['dist-tags'].latest );
			}
			
		});
	});
}

function getVersion( packageName, callback ) {
	if( cache[ packageName ] && ( cache[ packageName ].time - cacheTimeout ) < Date.now() ) {
		callback( cache[ packageName ].version );
	} else {
		loadVersion( packageName, function( version ){
			cache[ packageName ] = {
				version: version,
				time: Date.now()
			};

			callback( version );
		});
	}
}

function getPackageVersions( packages, callback ) {
	var tasks = [],
		result = {},
		i,
		get = function( packageName, done ) {
			getVersion( packageName, function( version ){
				if( version ) {
					result[ packageName ] = version;
					done();
				} else {
					done( 'Unknown package ' + packageName );
				}
			});
		};

	for( i = 0; i < packages.length; i++ ) {
		if( packages[ i ].indexOf( 'deepstream' ) === -1 ) {
			callback( 'Package ' + packages[ i ] + ' does not contain "deepstream". ' );
			return;
		}
		tasks.push( get.bind( this, packages[ i ] ) );
	}

	async.parallel( tasks, function( err ){
		callback( err, result );
	});
}

app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/versions',function(req, res){
	res.set( 'Access-Control-Allow-Origin', '*' );

	if( !req.body ) {
		res.status( 400 ).send( 'Data missing' );
		return;
	}

	if( !(req.body.packets instanceof Array ) ) {
		res.status( 400 ).send( 'Invalid data' );
		return;
	}
	
	getPackageVersions( req.body.packets, function( error, packetsMap ){
		if( error ) {
			res.status( 400 ).send( error );
		} else {
			res.send( JSON.stringify( packetsMap ) );
		}
	});
});

app.get( '/versions/reset', function( req, res ){
	cache = {};
	res.send( 'OK' );
});

app.listen( 3000, function() {
	console.log( 'Listening for npm-versions on port 3000' );
} );
