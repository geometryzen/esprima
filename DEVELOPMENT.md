# Developer Guide

## Notes

1. For `is_xyz` type guards, the preference is to check the `type` property rather than use `instanceof` because of the reinterpret functionality.

2. The reinterpret code is hacky and uses mutation of classes. It would be better to create new instances. This may need to be done carefully to retain positional and comment information.

