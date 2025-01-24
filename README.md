# sfdx-plugin-source-read

> sfdx/sf plugin to read Metadata e.g. full Profiles via CRUD Metadata API

For certain Metadata Types there is a different behaviour of the [file-based](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retrieve.htm) vs. [CRUD-based](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm) Metadata API.

This plugin provides a `sf force source read` command to read Metadata using the "CRUD-based" Metadata API similar to `sf force source retrieve` (which uses the "file-based" Metadata API).

> [!NOTE]
> This plugin simply returns the unfiltered response from the CRUD-based Metadata API.

In addition to retrieving `Profiles`, this plugin is useful for retrieving `RecordTypes` and `CustomObjectTranslations`.

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
sf force source read -m "CustomObjectTranslation:Task-de"
```

## Example

### Retrieving Profiles using the file-based Metadata API

When retrieving Profiles, the file-based Metadata API [behaves differently for source-tracked and non source-tracked orgs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_tracking_source_tracking_profiles.htm):

> Without source tracking, retrieving profiles only returns some profile information

a.k.a. a minimal Profile containing only `userPermissions` and entries for components listed in the `package.xml` of the retrieve request.

> With source tracking, retrieving profiles returns profile information pertaining to anything else specified in the package.xml file plus any components getting tracked by source tracking

a.k.a. a more kind of "full" Profile containing entries for all metadata having a `SourceMember` record in that org.

### Reading Profiles using the CRUD Metadata API

The CRUD Metadata API shows yet another behaviour:

It returns a kind of "full" Profile independent of source tracking and even containing entries for metadata from Managed Packages etc.

> [!WARNING]
> Unfortunately Profiles might include `tabVisibilites` for tabs not available in the org (see [#66](https://github.com/amtrack/sfdx-plugin-source-read/issues/66)).
>
> Without further processing this will cause deployment errrors.
