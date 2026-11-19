import AuthenticationServices
import Capacitor
import WebKit

// Register before the remote website loads. Intercept only our Supabase OAuth
// endpoint, never arbitrary external links or embedded frames.
@objc(HuellaBridgeViewController)
class HuellaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        #if DEBUG
        // Opt-in, isolated simulator fixture only. Never compiled into TestFlight.
        if let fixturePath = ProcessInfo.processInfo.environment["HUELLA_OFFLINE_FIXTURE"],
           let fixtureData = try? Data(contentsOf: URL(fileURLWithPath: fixturePath)),
           let fixture = (try? JSONSerialization.jsonObject(with: fixtureData)) as? [String: Any],
           fixture["owner"] as? String == "11111111-1111-4111-8111-111111111111",
           let records = fixture["records"] as? [[String: Any]], let script = fixture["script"] as? String {
            do {
                let directory = try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent("Huella")
                let db = try NativeDatabase(directory: directory)
                if fixture["migration"] as? Bool != true && !UserDefaults.standard.bool(forKey:"huella-offline-fixture-seeded") {
                    try db.write(owner:"11111111-1111-4111-8111-111111111111",records:records)
                    UserDefaults.standard.set(true,forKey:"huella-offline-fixture-seeded")
                }
                if fixture["migration"] as? Bool != true {UserDefaults.standard.set(true,forKey:"huella-native-migration-v1")}
                webView?.configuration.userContentController.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentStart,forMainFrameOnly:true))
            } catch { fatalError("Isolated offline fixture failed: \(error)") }
        }
        #endif
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(NativeStorePlugin())
    }
}

@objc(NativeAuthPlugin)
class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    let identifier = "NativeAuthPlugin"
    let jsName = "NativeAuth"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)]
    private var pendingCall: CAPPluginCall?

    @objc func authenticate(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https",
              url.host == "fghxwycixcawwtctknmp.supabase.co", url.path == "/auth/v1/authorize",
              url.user == nil, url.password == nil, url.port == nil else {call.reject("Invalid sign-in address");return}
        DispatchQueue.main.async { [self] in
            guard session == nil, pendingCall == nil else {call.reject("Sign-in is already open");return}
            pendingCall = call; start(url)
        }
    }
    private var session: ASWebAuthenticationSession?
    private var timeout: DispatchWorkItem?
    private var pendingState: String?
    private var callback: URL?
    private var anchor: UIWindow?

    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard navigationAction.targetFrame?.isMainFrame != false,
              let url = navigationAction.request.url,
              url.scheme == "https", url.host == "fghxwycixcawwtctknmp.supabase.co",
              url.path == "/auth/v1/authorize" else { return nil }
        // Cancel Capacitor's default external-Safari navigation immediately.
        DispatchQueue.main.async { [weak self] in self?.start(url) }
        return true
    }

    private func start(_ url: URL) {
        guard session == nil else { return }
        guard var auth = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let redirect = auth.queryItems?.first(where: { $0.name == "redirect_to" })?.value,
              let original = URL(string: redirect),
              original.scheme == "https", original.host == "flashmind-35q4.onrender.com",
              original.port == nil, original.user == nil, original.password == nil,
              original.path == "/auth/callback",
              var returning = URLComponents(url: original, resolvingAgainstBaseURL: false),
              let window = bridge?.viewController?.view.window else {
            finish(error: "native_failed")
            return
        }
        callback = original
        anchor = window
        let state = UUID().uuidString
        pendingState = state
        returning.queryItems = (returning.queryItems ?? []).filter {
            !["native", "native_state", "code", "error"].contains($0.name)
        } + [URLQueryItem(name: "native", value: "1"), URLQueryItem(name: "native_state", value: state)]
        auth.queryItems = (auth.queryItems ?? []).filter { $0.name != "redirect_to" }
            + [URLQueryItem(name: "redirect_to", value: returning.url!.absoluteString)]
        let login = ASWebAuthenticationSession(url: auth.url!, callbackURLScheme: "app.huella.auth") { [weak self] url, error in
            DispatchQueue.main.async {
                guard let self, self.pendingState == state else { return }
                if let error = error as NSError? {
                    self.finish(error: error.domain == ASWebAuthenticationSessionError.errorDomain &&
                        error.code == ASWebAuthenticationSessionError.canceledLogin.rawValue ? "native_cancelled" : "native_failed")
                    return
                }
                guard let url, url.scheme == "app.huella.auth", url.host == "auth", url.path == "/callback",
                      let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                      components.queryItems?.filter({ $0.name == "state" }).count == 1,
                      components.queryItems?.first(where: { $0.name == "state" })?.value == state,
                      components.queryItems?.contains(where: { $0.name == "error" }) != true,
                      components.queryItems?.filter({ $0.name == "code" }).count == 1,
                      let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
                      !code.isEmpty, code.count <= 2048 else {
                    self.finish(error: "native_failed")
                    return
                }
                self.finish(code: code)
            }
        }
        login.presentationContextProvider = self
        session = login // ASWebAuthenticationSession must be retained.
        guard login.start() else { finish(error: "native_failed"); return }
        let timer = DispatchWorkItem { [weak self] in
            guard self?.pendingState == state else { return }
            self?.finish(error: "native_timeout")
        }
        timeout = timer
        DispatchQueue.main.asyncAfter(deadline: .now() + 180, execute: timer)
    }

    private func finish(code: String? = nil, error: String? = nil) {
        // Clear state before cancel(), whose completion may run asynchronously.
        pendingState = nil
        timeout?.cancel()
        timeout = nil
        let previous = session
        session = nil
        previous?.cancel()
        anchor = nil
        let original = callback
        callback = nil
        if let call = pendingCall {
            pendingCall = nil
            if let code {call.resolve(["code":code])} else {call.reject(error ?? "native_failed")}
            return
        }
        var target: URLComponents
        if let code, let original, var success = URLComponents(url: original, resolvingAgainstBaseURL: false) {
            success.queryItems = (success.queryItems ?? []).filter {
                !["native", "native_state", "code", "error"].contains($0.name)
            } + [URLQueryItem(name: "code", value: code)]
            target = success
        } else {
            target = URLComponents(string: "https://flashmind-35q4.onrender.com/auth/login")!
            target.queryItems = [URLQueryItem(name: "error", value: error ?? "native_failed")]
            if let original,
               let next = URLComponents(url: original, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "redirectTo" })?.value {
                target.queryItems?.append(URLQueryItem(name: "redirectTo", value: next))
            }
        }
        // Load the normal server callback IN THE ORIGINAL WEBVIEW. Its PKCE
        // verifier cookie is here, and the resulting session cookies stay here.
        // Error navigation also remounts the login UI, clearing its spinner.
        if let url = target.url { webView?.load(URLRequest(url: url)) }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return anchor ?? ASPresentationAnchor()
    }
}
