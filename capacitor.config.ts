import type { CapacitorConfig } from "@capacitor/cli";
// The interface ships inside the IPA. The network is a sync service, not a boot dependency.
const config: CapacitorConfig = {
  appId: "app.huella",
  appName: "Huella",
  loggingBehavior: "none",
  webDir: "mobile/dist",
  server: { cleartext: false },
  ios: {
    limitsNavigationsToAppBoundDomains: true,
    contentInset: "never",
    backgroundColor: "#0f0d0a",
  },
  plugins: {
    SplashScreen: {launchAutoHide:true,launchShowDuration:500,launchFadeOutDuration:200,backgroundColor:"#0f0d0a",showSpinner:false},
  },
};
export default config;
