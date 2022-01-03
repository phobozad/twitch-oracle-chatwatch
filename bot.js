// TMI is the Twitch Chat API
const tmi = require('tmi.js');
// fs and ini for config file parsing
var fs = require('fs'), ini = require('ini');
// Chalk for colored text output
const chalk = require('chalk');
// Path for finding the config file when compiled as an exe
const path = require('path');
// Oracle Database Library
const oradb = require('oracledb');
oradb.outFormat = oradb.OUT_FORMAT_OBJECT;
oradb.autoCommit = true;


// For pkg binary building
// From: https://github.com/rocklau/pkg-puppeteer/blob/master/index.js
const isPkg = typeof process.pkg != 'undefined';

// Pull in configuration from settings.ini file in the same folder as executable if we are running as a pkg-compiled *.exe
// Need this to support double-click of the *.exe since working directory isn't set correctly in that case
if(isPkg){
	var configFile = path.join(path.dirname(process.execPath), 'settings.ini');
	var workingDir = path.dirname(process.execPath)
}
else{
	var configFile = './settings.ini';
	var workingDir = path.dirname('./')
}
var config = ini.parse(fs.readFileSync(configFile, 'utf-8'))

// Set default value of update interval to 5 seconds if not configured in INI file
if (!config.database.updateIntervalMs) config.database.updateIntervalMs = 5000

// Setup twitch settings
const twitchChatSettings = {
	identity: {
		username: config.twitch.username,
		password: config.twitch.password
	},
	channels: [
		config.twitch.channel
	]
};

// Build array of emote commands to recogize
// Map funtion trims spaces off each item. filter function removes any empty strings that may have gotten in
var validEmotes = config.marbles.playEmotes.split(',').map(item=>item.trim()).filter(Boolean)

console.log('App starting...use Ctrl+C to quit');
console.log(`Backend Database update interval is ${config.database.updateIntervalMs} milliseconds`);
console.log(`Twitch Channel is ${config.twitch.channel}`);
console.log(`Bot Username is ${config.twitch.username}`)

console.log(`Emote play commands recognized (in addition to !play):`)
validEmotes.forEach(emote => console.log(chalk.yellow(emote)))

// Connect to database
connectDatabase()


// We will buffer players in an array and only push this to the database every 5 seconds
var batchedPlayers = [];

// Create a Twitch Chat client with our options
const chatClient = new tmi.client(twitchChatSettings);

// Register our event handlers (defined below)
chatClient.on('message', onMessageHandler);
chatClient.on('connected', onConnectedHandler);

// Connect to Twitch:
console.log(`* Connecting to Twitch Chat...`)
chatClient.connect();


// Called every time a message comes in
function onMessageHandler (target, context, msg, self) {
	if (self) { return; } // Ignore messages from the bot

	// Remove whitespace from chat message
	const commandName = msg.trim();
	
	// Debug line to see all the info we get with the message
	//console.log(`Context: ${JSON.stringify(context)}`)

	// If the command is known, let's execute it
	if (commandName.toLowerCase().includes('!play')) {
		// Twitch API only has true/false for subscriber currently - not the specific tier.  Map true to 1 and false to 0 for now
		if(context['subscriber'])
			var subscriberTier = 1
		else
			var subscriberTier = 0
		
		addPlayer( { name: context['display-name'], id: context['user-id'], subscriber: subscriberTier} );
	}
	// In addition to !play, check for any valid emote command that also joins
	else if(validEmotes.some(emote=>commandName.includes(emote))){
		// Twitch API only has true/false for subscriber currently - not the specific tier.  Map true to 1 and false to 0 for now
		if(context['subscriber'])
			var subscriberTier = 1
		else
			var subscriberTier = 0
		
		addPlayer( { name: context['display-name'], id: context['user-id'], subscriber: subscriberTier } );
	}
}

// Add player to current batch queue to be inserted into the DB
function addPlayer (player) {
	console.log(`Adding Player ${chalk.bold(player.name)} to next update batch`);
	batchedPlayers.push(player);
	return;
}

function batchUpdate() {

	// Only need to push update to database if we have some players pending in the batch queue
	if (batchedPlayers.length > 0)
	{
		// Grab a snapshot of the queue, since it may get changed while we're processing it
		var currentBatch = batchedPlayers;


		// Build our batch query
		var query = `INSERT INTO "${config.database.tableName}" ` +
					`("${config.database.playerNameField}", "${config.database.twitchIDField}", "${config.database.subscriberTierField}") ` +
					`VALUES (:playerName, :twitchID, :subscriberTier)`;
		
		const options = {
			// Continue with remaining records if one errors out when inserting
			batchErrors: true,
			// Manually map data types (optional, but recommended)
			bindDefs: {
				playerName: { type: oradb.STRING, maxSize: 255 },
				twitchID: { type: oradb.STRING, maxSize: 255 },
				subscriberTier: { type: oradb.NUMBER },
			}
		};

		// Loop over the batch of players and build the data object for the bulk SQL query
		var updateData = []
		currentBatch.forEach( player=> {
			updateData.push( { playerName: player.name, twitchID: player.id, subscriberTier: player.subscriber} )
		})

		// Execute bulk query
		dbcon.executeMany(query, updateData, options,function(err, result){
			
			// Errors
			if (err){
				console.error(chalk.red(`DB Error - ${err}`));
				// Schedule next run for next batch
				setTimeout(batchUpdate,config.database.updateIntervalMs);
				return;
			}
			
			if (result.batchErrors){
				result.batchErrors.forEach( error => {
					console.log(chalk.red(`DB Record Insert Error: ${error}`))
				})
			}

			// Success
			console.log(`Successfully added ${result.rowsAffected} players to Database.`);

		})

		// Remove the players from the queue after we fire off the API call
		var remainingBatch = Array.from(batchedPlayers);
		currentBatch.forEach(function (player) {
			var index = remainingBatch.indexOf(player);
			if (index > -1)	remainingBatch.splice(index,1)
		})
		// Update the array with the filtered/cleaned version
		batchedPlayers = remainingBatch;
		
	}

	// Schedule next run for next batch
	setTimeout(batchUpdate,config.database.updateIntervalMs);

	return;
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
	console.log(chalk.green(`* Connected to Twitch Chat - ${addr}:${port}`));
}

async function connectDatabase(){
	console.log(`* Connecting to Oracle Database...`)
	// Using Easy Connect Plus connection format
	// Wallet is stored in local `oracle_wallet` directory with client TLS certificate to auth to Oracle (download this from the Oracle web portal)
	const dbURL = `tcps://${config.database.host}:${config.database.port}/${config.database.service_name}?wallet_location=${path.join(workingDir, 'oracle_wallet')}&retry_count=${config.database.retry_count}&retry_delay=${config.database.retry_delay}`

	// Check that the wallet file has been extracted into the folder
	if ( !fs.existsSync(path.join(workingDir, 'oracle_wallet', 'cwallet.sso')) ){
		console.log(chalk.red(`* Error - Unable to find Oracle Wallet TLS Certificate.`))
		console.log(chalk.red(`Please download the wallet *.zip file from the Oracle cloud portal and extract it into the 'oracle_wallet' folder`))
		console.log(chalk.red(`In the Oracle Cloud Portal Navigate to Oracle Database > Autonomous Database > [Database Name] > DB Connection > Instance Wallet > Download Wallet`))
		process.exit(1)
	}

	try{
		// Point to local Oracle Instant Client libraries in this app's folder
		const oraClientDir = path.join(workingDir, 'oracle_instant')
		oradb.initOracleClient({libDir: oraClientDir})

		dbcon = await oradb.getConnection(
			{
				user: config.database.username,
				password: config.database.password,
				connectString: dbURL
			}
		);
	}
	catch (err){
		console.log(chalk.red(`* Error connecting to database - ${err}`))
		
		// Need to use process.kill instead of process.exit or else we'll hang due to the Oracle libraries
		process.exitCode = 1
		process.kill(process.pid, 'SIGTERM');
	}

	console.log(chalk.green(`* Connected to Oracle Database - ${config.database.service_name}`))

	// Setup interval for pushing the current batch of players to the database
	// Use timeouts that get reset after every update to avoid overlapping/duplicate API calls if things get bogged down
	setTimeout(batchUpdate,config.database.updateIntervalMs);
	
}