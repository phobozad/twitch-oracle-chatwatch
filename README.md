# twitch-oracle-chatwatch

## Overview
This app will login to a specific Twitch.tv channel and watch for users entering the `!play` command in chat.

Each user that enters this command will be added to an Oracle Database that can be used to create player records and provide auto-completion of Twitch usernames.

Data will be batched up and pushed into the database on a configurable interval (default: 5 seconds).  If there is more than one player that entered `!play` during the interval, the data will be inserted as a single row with multiple comma-separated usernames.

## Database Connection Setup
### Wallet for TLS Authentication
Oracle Cloud databases use TLS Authentication & Encryption to authorize a client to connect to the database.  This is done by use of a "wallet" *.zip file that can be downloaded from the Oracle Cloud portal.  This *.zip file needs to be extracted into the `oracle_wallet` folder so the application can connect to the database.

To download the wallet *.zip file:
1.	Login to Oracle Cloud: https://cloud.oracle.com/
	* Enter your Cloud Account Name (different from your username - i.e. tenant name), Username & Password to login to the portal
2.	Navigate to the list of Autonomous Databases in the account
	* Top-Left Hamburger Menu > Oracle Database > Autonomous Database
3.	Click the name of the database being used for Marbles stats
4.	Click the `DB Connection` button at the top
5.	In the screen that pops up, select `Instance Wallet` as the `Wallet Type` and click `Download Wallet`
6.	Enter a password to protect the wallet with (this will not actually be used with this application but it must be set)
7.	Click `Download` to download a *.zip file
8.	Extract the contents of the *.zip file into the `oracle_wallet` folder

**Securely store and do not share this wallet file with anyone as it is one of two factors required to access the database (username/password also required).**


### Database Connection Parameters & Login
In addition to the Wallet file, a username & password is required to access the database.  This username/password is separate from your Oracle Cloud account login and is specific to the database instance.

You can either use the database ADMIN login that was setup when creating the database or create a separate username & password.  Security best practice is to use a dedicated username/password for this application.  That allows the use of an account with restricted privledges on the database - only those that are required.

#### To create a Username & Password to use with the application:
1.	Login to Oracle Cloud: https://cloud.oracle.com/
	* Enter your Cloud Account Name (different from your username - i.e. tenant name), Username & Password to login to the portal
2.	Navigate to the list of Autonomous Databases in the account
	* **Top-Left Hamburger Menu > Oracle Database > Autonomous Database**
3.	Click the name of the database being used for Marbles stats
4.	Click the `Database Actions` button at the top
5.	From the Launchpad, select `Database Users` under the `Administration` section at the bottom of the screen
6.	Click the `Create User` button
7.	Fill in the desired username (e.g. `MARBLESAPP`) and password
8.	Do not select any other options (e.g. Graph, Web Access, OML)
9.	Select the `Granted Roles` tab at the top to grant the required permissions
10.	Find the `MARBLES_APP` role and check `GRANTED` and `DEFAULT`
11. Click Create User
	* If you get an error about password verification, use a more complex password (Uppercase, Lowercase, Number, Symbol, 12+ length)
12.	Configure this username and password in the `settings.ini` file under the `[database]` section.

#### To find the Database Host, Port, and Service Name:
1.	Login to Oracle Cloud: https://cloud.oracle.com/
	* Enter your Cloud Account Name (different from your username - i.e. tenant name), Username & Password to login to the portal
2.	Navigate to the list of Autonomous Databases in the account
	* **Top-Left Hamburger Menu > Oracle Database > Autonomous Database**
3.	Click the name of the database being used for Marbles stats
4.	Click the `DB Connection` button at the top
5.	In the screen that pops up, click the `Show` link next to the `Medium` TNS Name under the `Connection Strings` section
6.	Note the Port Number in the connection string `(port=1522)`
7.	Note the Host in the connection string `(host=adb.us-ashburn-1.oraclecloud.com)`
8.	Note the Service Name in the connection string `(service_name=ga3m13m134_marbles_medium.adb.oraclecloud.com)`
9.	Enter these 3 values into the `settings.ini` config file under the `[database]` section.

## Installation
### Windows
**Download & double-click to run the pre-compiled version that comes with NodeJS bundled in or run from source using below steps:**

1.	Install NodeJS 14+ from https://nodejs.org/en/ (LTS release reccomended).
	* The "Tools for Native Modules" isn't required to use this app, so this can be left unchecked during installation.
2.	Download the app using a git pull or by downloading a ZIP file of the repo from github and extracting to a folder.
3.	Run the "Node.js command prompt" shortcut that is now in the start menu
	* This just runs `C:\Program Files\nodejs\nodevars.bat` assuming default install location was selected for NodeJS
4.	Navigate in the command prompt to the folder that holds this app
	```
	cd "c:\users\username\downloads\twitch-oracle-chatwatch"
	```
5.	Install the required NodeJS modules (This must be run inside the app's folder)
	```
	npm install
	```
6.	Install Visual Studio 2017 Redistributable if not already installed (required for Oracle Instant Client)
	https://aka.ms/vs/17/release/vc_redist.x64.exe
7.	Download the Oracle Instant Client (Basic Lite version) and extract into the `oracle_instant` folder
	* Extract everything from the sub-folder in the ZIP into the `oracle_instant` folder - do not keep the folder name used in the ZIP (that includes version number)
	https://download.oracle.com/otn_software/nt/instantclient/instantclient-basiclite-windows.zip
	https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html
8.	Copy the `settings.ini.example` file to `settings.ini`
8.	Edit the `settings.ini` file and fill in the required info (username, password, API key, table name, etc.)
9.	Start the App (bot.js) using NodeJS
	```
	node bot.js
	```

For subsequent launches, just run the `node bot.js` command to start the app from within the Node.js command prompt.  To simplify this, you could create a batch file that can just be double-clicked to launch.

#### Example startbot.bat (adjust paths to match your environment):
```
cd "c:\users\username\downloads\twitch-oracle-chatwatch"
"C:\Program Files\nodejs\nodevars.bat"
node bot.js
```

## Compiling
```
git clone http://x.x.x.x/twitch-oracle-chatwatch
cd twitch-oracle-chatwatch
npm install
npm install -g pkg
```

On Windows:
```
npm run buildwin
npm run packagewin
```