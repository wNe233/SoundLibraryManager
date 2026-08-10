import AppKit

final class DragSource: NSObject, NSApplicationDelegate, NSDraggingSource {
    private let fileURL: URL
    private var panel: NSPanel?

    init(filePath: String) {
        self.fileURL = URL(fileURLWithPath: filePath)
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let mouse = NSEvent.mouseLocation
        let size = NSSize(width: 96, height: 96)
        let frame = NSRect(
            x: mouse.x - size.width / 2,
            y: mouse.y - size.height / 2,
            width: size.width,
            height: size.height
        )

        let panel = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.ignoresMouseEvents = false

        let view = DragView(frame: NSRect(origin: .zero, size: size), fileURL: fileURL, source: self)
        panel.contentView = view
        panel.orderFrontRegardless()
        self.panel = panel

        DispatchQueue.main.async {
            view.startDrag()
        }
    }

    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation {
        .copy
    }

    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) {
        NSApp.terminate(nil)
    }
}

final class DragView: NSView {
    private let fileURL: URL
    private weak var source: DragSource?

    init(frame frameRect: NSRect, fileURL: URL, source: DragSource) {
        self.fileURL = fileURL
        self.source = source
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func startDrag() {
        guard let source else {
            NSApp.terminate(nil)
            return
        }

        let draggingItem = NSDraggingItem(pasteboardWriter: fileURL as NSURL)
        let icon = NSWorkspace.shared.icon(forFile: fileURL.path)
        icon.size = NSSize(width: 64, height: 64)
        draggingItem.setDraggingFrame(bounds.insetBy(dx: 16, dy: 16), contents: icon)

        guard let event = NSEvent.mouseEvent(
            with: .leftMouseDragged,
            location: NSPoint(x: bounds.midX, y: bounds.midY),
            modifierFlags: [],
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window?.windowNumber ?? 0,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1
        ) else {
            NSApp.terminate(nil)
            return
        }

        let session = beginDraggingSession(with: [draggingItem], event: event, source: source)
        session.animatesToStartingPositionsOnCancelOrFail = false
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

guard CommandLine.arguments.count > 1 else {
    exit(1)
}

let source = DragSource(filePath: CommandLine.arguments[1])
app.delegate = source
app.run()
