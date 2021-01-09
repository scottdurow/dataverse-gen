# dataverse-gen

Creates early bound TypeScript interfaces to work with `dataverse-ify`.

## Usage

1.  Add authentication for your Microsoft Dataverse Environment:\
`~$ npx dataverse-auth [environment]`\
E.g.\
`~$ npx dataverse-auth contosoorg.crm.dynamics.com`

1. Initialise dataverse-ify to create .dataverse-gen.json config file:\
`~$ npx dataverse-gen init`

1. At any time, you can re-generate the early bound types using:\
`~$ npx dataverse-gen`

## Installing Globally
If you would rather install dataverse-gen globally you can use:\
`~$ npm install -g dataverse-gen dataverse-auth`

This will then allow you to simply use:\
`~$ dataverse-auth`\
`~$ dataverse-gen`

For more information see the [dataverse-ify project](https://github.com/scottdurow/dataverse-ify/wiki)
