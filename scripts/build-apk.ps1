param(
    [string]$Sdk = 'C:\Users\HP\AppData\Local\Android\sdk',
    [string]$Jdk = 'F:\Android\Android Studio\jbr'
)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$output = Join-Path $project 'dist'
$scratch = Join-Path $project '.tools\build'
$androidJar = Join-Path $Sdk 'platforms\android-35\android.jar'
$buildTools = Join-Path $Sdk 'build-tools\35.0.0'
$main = Join-Path $project 'android\app\src\main'
New-Item -ItemType Directory -Force -Path $output,$scratch,(Join-Path $scratch 'classes'),(Join-Path $scratch 'dex') | Out-Null
function Invoke-Checked([string]$exe,[string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "Build step failed: $exe" }
}
Invoke-Checked 'node' @((Join-Path $PSScriptRoot 'bundle.cjs'))
$manifest = Get-Content (Join-Path $main 'AndroidManifest.xml') -Raw
$manifest = $manifest.Replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android">','<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.shishi.studytime" android:versionCode="7" android:versionName="1.0.6"><uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35"/>')
$manifestPath = Join-Path $scratch 'AndroidManifest.xml'
[System.IO.File]::WriteAllText($manifestPath,$manifest)
$resourceZip = Join-Path $scratch 'resources.zip'
Invoke-Checked (Join-Path $buildTools 'aapt2.exe') @('compile','--dir',(Join-Path $main 'res'),'-o',$resourceZip)
$unsigned = Join-Path $scratch 'unsigned.apk'
Invoke-Checked (Join-Path $buildTools 'aapt2.exe') @('link','-o',$unsigned,'-I',$androidJar,'--manifest',$manifestPath,'-A',(Join-Path $main 'assets'),$resourceZip)
Invoke-Checked (Join-Path $Jdk 'bin\javac.exe') @('-encoding','UTF-8','-source','17','-target','17','-classpath',$androidJar,'-d',(Join-Path $scratch 'classes'),(Join-Path $main 'java\com\shishi\studytime\MainActivity.java'))
$classJar = Join-Path $scratch 'classes.jar'
Invoke-Checked (Join-Path $Jdk 'bin\jar.exe') @('--create','--file',$classJar,'-C',(Join-Path $scratch 'classes'),'.')
Invoke-Checked (Join-Path $Jdk 'bin\java.exe') @('-cp',(Join-Path $buildTools 'lib\d8.jar'),'com.android.tools.r8.D8','--lib',$androidJar,'--min-api','26','--output',(Join-Path $scratch 'dex'),$classJar)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($unsigned,[System.IO.Compression.ZipArchiveMode]::Update)
try { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $scratch 'dex\classes.dex'),'classes.dex') | Out-Null } finally { $zip.Dispose() }
$aligned=Join-Path $scratch 'aligned.apk'
Invoke-Checked (Join-Path $buildTools 'zipalign.exe') @('-f','-p','4',$unsigned,$aligned)
$key=Join-Path $project '.tools\debug.keystore'
if (!(Test-Path $key)) { Invoke-Checked (Join-Path $Jdk 'bin\keytool.exe') @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Android Debug,O=Android,C=US','-keyalg','RSA','-keysize','2048','-validity','10000') }
$apk=Join-Path $output 'shishi-1.0.6.apk'
Invoke-Checked (Join-Path $Jdk 'bin\java.exe') @('-jar',(Join-Path $buildTools 'lib\apksigner.jar'),'sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$apk,$aligned)
Invoke-Checked (Join-Path $Jdk 'bin\java.exe') @('-jar',(Join-Path $buildTools 'lib\apksigner.jar'),'verify','--verbose',$apk)
Get-FileHash $apk -Algorithm SHA256 | Format-List
Write-Host "APK created: $apk"
