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

## `.dataverse-gen.json`
The configuration for dataverse-gen is stored in the `.dataverse-gen.json` file. You can edit this manually if you want rather than use `npx dataverse-gen init`.  This is the only file that is needed to run `npx dataverse-gen`.

The standard templates use references to the dataverse-ify types, and so unless you edit the templates (see below) you will need to install these types using:

```shell
npm install --save dataverse-ify
```
## Custom Templates
If you wanted to just generate Attribute `enum` constants and stop there, you can easily customise the scripts to suit your needs by using:

```shell
npx dataverse-gen eject
```

This will create a step of templates ready to customise in the `_templates` folder. Once you have made your updates, just run `npx dataverse-gen` again. The templates use the awesome [ejs](https://ejs.co/) project. E.g.

```typescript
// Attribute constants
export const enum <%- locals.SchemaName %>Attributes {
<%locals.Properties && locals.Properties.forEach(function(property){ _%>
 <%- property.SchemaName %> = "<%- property.Name %>",
<%})_%>
}
```

If you wanted to revert back to the standard templates, just delete the  `_templates` folder
## Installing Globally
If you would rather install dataverse-gen globally you can use:\
`~$ npm install -g dataverse-gen dataverse-auth`

This will then allow you to simply use:\
`~$ dataverse-auth`\
`~$ dataverse-gen`

For more information see the [dataverse-ify project](https://github.com/scottdurow/dataverse-ify/wiki)

Notes:
1. Files differ by case only. If you get an error from the imports in the generated types, it is likely that your file names have the wrong case. dataverse-gen will remember re-use the file name if it exsts when generating - even if the casing is different. The solution is to completely remove all your generated files and regenerated them to get the correct casing.
