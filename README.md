# dataverse-gen

Creates early bound TypeScript interfaces to work with `dataverse-ify`.
For more information see the [dataverse-ify project](https://github.com/scottdurow/dataverse-ify/wiki)

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

Notes:
1. Files differ by case only. If you get an error from the imports in the generated types, it is likely that your file names have the wrong case. dataverse-gen will remember re-use the file name if it exsts when generating - even if the casing is different. The solution is to completely remove all your generated files and regenerated them to get the correct casing.
