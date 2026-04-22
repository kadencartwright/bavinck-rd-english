// This helps use auto generate libraries you can use in the language of
// your choice. You can have multiple generators if you use multiple languages.
// Just ensure that the output_dir is different for each generator.
generator target {
  output_type "typescript"
  output_dir "../libs/provider-clients/src"
  version "0.221.0"
  default_client_mode async
  module_format "cjs"
}
