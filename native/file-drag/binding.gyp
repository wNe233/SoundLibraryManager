{
  "targets": [
    {
      "target_name": "native_file_drag",
      "sources": [],
      "conditions": [
        [ "OS=='mac'", {
          "sources": [ "src/native_file_drag.mm" ],
          "xcode_settings": {
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "OTHER_LDFLAGS": [
              "-framework AppKit",
              "-framework Foundation"
            ]
          }
        }],
        [ "OS=='win'", {
          "sources": [ "src/native_file_drag_win.cc" ],
          "libraries": [
            "ole32.lib",
            "shell32.lib",
            "user32.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [
                "/std:c++17"
              ]
            }
          }
        }]
      ]
    }
  ]
}
