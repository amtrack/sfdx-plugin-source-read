# sfdx-plugin-source-read

> sfdx/sf plugin to read Metadata via CRUD Metadata API

For certain Metadata Types there is a different behaviour of the [file-based](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retrieve.htm) vs. [CRUD-based](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm) Metadata API.

This plugin provides the `sf force source read` command to read Metadata using the "CRUD-based" Metadata API
similar to `sf force source retrieve` (which uses the "file-based" Metadata API).

## Example

- When retrieving a `Profile` using `sf force source retrieve` it only contains `<userPermissions>`.
- When retrieving a `Profile` using `sf force source read` it contains all fields like `<fieldPermissions>`, `<tabVisibilities>` and more.

## Installation

```console
sf plugins install sfdx-plugin-source-read
```

## Usage

```console
sf force source read -m "Profile:Admin"
sf force source read -p force-app/main/default/profiles/Admin.profile-meta.xml
sf force source read -m "RecordType:Account.Business"
sf force source read -p force-app/main/default/objects/Account/recordTypes/Business.recordType-meta.xml
```

## Disclaimer

Currently this has been tested only for `Profiles` and `RecordTypes`.
