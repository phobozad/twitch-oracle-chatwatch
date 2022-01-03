Write-Output "Copying example settings file..."
Copy-Item -Path ".\settings.ini.example" -Destination ".\build\settings.ini" -Force

Write-Output "Checking for Oracle Instant Client Library..."

$fileGlob = "instantclient-basiclite-windows*.zip"

# Cleanup any existing folder
if(Test-Path ".\build\oracle_instant\")
{
    Remove-Item -Path ".\build\oracle_instant\" -Force -Recurse
}

if(Test-Path $fileGlob -PathType Leaf)
{
    Write-Output "Oracle Client Found, using cached version"
    $oraclefile = Get-ChildItem $fileGlob | Select-Object -First 1 -Expand Name
}
else{
    $uri = "https://download.oracle.com/otn_software/nt/instantclient/instantclient-basiclite-windows.zip"
    Write-Output "Oracle Client files not found, downloading from $uri"
    $oraclefile = $(Split-Path -Path $uri -Leaf)
    Invoke-WebRequest -Uri $uri -OutFile $oraclefile
}
Write-Output "Extracting Oracle Client..."
Expand-Archive $oraclefile -DestinationPath ".\build\oracle_instant" -Force

Write-Output "Renaming Oracle Client Folder..."
$extractedFolder = Get-ChildItem ".\build\oracle_instant\" -Attributes Directory | Select-Object -First 1
$extractedFolder | Get-ChildItem -Recurse | Move-Item -Destination ".\build\oracle_instant" -Force
$extractedFolder | Remove-Item -Force -Recurse

Write-Output "Oracle Instant Client Extraction Complete"

# Create emtpy oracle_wallet directory
Write-Output "Creating oracle_wallet folder"
$null = New-Item -Type Directory ".\build\oracle_wallet" -Force
# Need to add a dummy file into the folder otherwise Compress-Archive won't include it (ignores empty folders)
$null = New-Item -Type File ".\build\oracle_wallet\extract wallet.zip file here.txt"