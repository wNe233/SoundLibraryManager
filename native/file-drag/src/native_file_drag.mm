#include <node_api.h>

#import <AppKit/AppKit.h>

@interface NativeFileDragSource : NSObject <NSDraggingSource>
@end

@implementation NativeFileDragSource
- (NSDragOperation)draggingSession:(NSDraggingSession *)session sourceOperationMaskForDraggingContext:(NSDraggingContext)context {
  return NSDragOperationCopy;
}
@end

namespace {

NativeFileDragSource *SharedDragSource() {
  static NativeFileDragSource *source = nil;
  if (!source) source = [[NativeFileDragSource alloc] init];
  return source;
}

napi_value MakeBoolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

NSString *StringFromNapi(napi_env env, napi_value value) {
  size_t length = 0;
  napi_get_value_string_utf8(env, value, nullptr, 0, &length);
  char *buffer = new char[length + 1];
  napi_get_value_string_utf8(env, value, buffer, length + 1, &length);
  NSString *result = [NSString stringWithUTF8String:buffer];
  delete[] buffer;
  return result;
}

NSView *FindDragViewAtMouse() {
  NSPoint screenPoint = [NSEvent mouseLocation];
  for (NSWindow *window in [NSApp orderedWindows]) {
    if (!window.isVisible || !window.contentView) continue;
    NSRect frame = window.frame;
    if (!NSPointInRect(screenPoint, frame)) continue;
    NSPoint windowPoint = [window convertPointFromScreen:screenPoint];
    NSView *hit = [window.contentView hitTest:windowPoint];
    return hit ?: window.contentView;
  }
  return NSApp.keyWindow.contentView ?: NSApp.mainWindow.contentView;
}

bool BeginNativeDrag(NSString *filePath) {
  if (filePath.length == 0) return false;
  NSURL *fileURL = [NSURL fileURLWithPath:filePath];
  if (![[NSFileManager defaultManager] fileExistsAtPath:filePath]) return false;

  auto startBlock = ^{
    NSView *view = FindDragViewAtMouse();
    if (!view || !view.window) return false;

    NSPoint screenPoint = [NSEvent mouseLocation];
    NSPoint windowPoint = [view.window convertPointFromScreen:screenPoint];
    NSPoint localPoint = [view convertPoint:windowPoint fromView:nil];

    NSImage *icon = [[NSWorkspace sharedWorkspace] iconForFile:filePath];
    icon.size = NSMakeSize(64, 64);

    NSDraggingItem *draggingItem = [[NSDraggingItem alloc] initWithPasteboardWriter:fileURL];
    NSRect dragFrame = NSMakeRect(localPoint.x - 32, localPoint.y - 32, 64, 64);
    [draggingItem setDraggingFrame:dragFrame contents:icon];

    NSEvent *event = [NSEvent mouseEventWithType:NSEventTypeLeftMouseDragged
                                       location:windowPoint
                                  modifierFlags:0
                                      timestamp:[[NSProcessInfo processInfo] systemUptime]
                                   windowNumber:view.window.windowNumber
                                        context:nil
                                    eventNumber:0
                                     clickCount:1
                                       pressure:1.0];
    if (!event) return false;

    NSDraggingSession *session = [view beginDraggingSessionWithItems:@[ draggingItem ] event:event source:SharedDragSource()];
    session.animatesToStartingPositionsOnCancelOrFail = NO;
    return true;
  };

  __block bool started = false;
  if ([NSThread isMainThread]) {
    started = startBlock();
  } else {
    dispatch_sync(dispatch_get_main_queue(), ^{
      started = startBlock();
    });
  }
  return started;
}

napi_value StartFileDrag(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) return MakeBoolean(env, false);
  NSString *filePath = StringFromNapi(env, args[0]);
  return MakeBoolean(env, BeginNativeDrag(filePath));
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "startFileDrag", NAPI_AUTO_LENGTH, StartFileDrag, nullptr, &fn);
  napi_set_named_property(env, exports, "startFileDrag", fn);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
