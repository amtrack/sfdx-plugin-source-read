# sfdx-plugin-source-read

> sfdx plugin to read Metadata via CRUD Metadata API

## Installation

```console
sfdx plugins:install sfdx-plugin-source-read
```

## Usage

```console
sfdx force:source:read -m "Profile:Admin"
sfdx force:source:read -p force-app/main/default/profiles/Admin.profile-meta.xml
sfdx force:source:read -m "RecordType:Account.Business"
sfdx force:source:read -p force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml
```

## Disclaimer

Currently this has been tested only for `Profiles` and `RecordTypes`.
