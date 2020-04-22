# cdsify-gen

Creates early bound TypeScript interfaces to work with `cdsify`.

## Usage

1.  Add authentication for your CDS Environment:\
`~$ npx node-cds-gen [tennant] [environment]`\
E.g.\
`~$ npx node-cds-gen contoso.onmicrosoft.com contosoorg.crm.dynamics.com`

1. Initialise cdsify to create .cdsify.json config file:\
`~$ npx cdsify-gen init`

1. At any time, you can re-generate the early bound types using:\
`~$ npx cdsify-gen`

## Installing Globally
If you would rather install cdsify-gen globally you can use:\
`~$ npm install -g cdsify-gen node-cds-auth`

This will then allow you to simply use:\
`~$ node-cds-auth`\
`~$ cdsify-gen`

For more information see the [cdsify project](https://github.com/scottdurow/cdsify/wiki)
