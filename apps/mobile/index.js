import "react-native-url-polyfill/auto";
import React from "react";
import Constants from "expo-constants";
import { AppState, NativeModules, Platform } from "react-native";
import { registerRootComponent } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Picker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import Workspace, { Boundary } from "../../packages/ui/Workspace.jsx";
import {
  client,
  resolveMobileGatewayUrl,
} from "../../packages/supabase/index.js";
const gatewayUrl = resolveMobileGatewayUrl(
  process.env.EXPO_PUBLIC_GATEWAY_URL,
  Constants.expoConfig?.hostUri
    ? "http://" + Constants.expoConfig.hostUri
    : NativeModules.SourceCode?.scriptURL,
  Platform.OS,
);
const db = client(gatewayUrl, {
  storage: AsyncStorage,
  detectSessionInUrl: false,
  persistSession: true,
  autoRefreshToken: true,
});
if (db)
  AppState.addEventListener("change", (state) =>
    state === "active" ? db.auth.startAutoRefresh() : db.auth.stopAutoRefresh(),
  );
async function pick() {
  const r = await Picker.getDocumentAsync({ copyToCacheDirectory: true });
  if (r.canceled) return null;
  const a = r.assets[0],
    f = new File(a.uri);
  return { name: a.name, size: f.size, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() };
}
async function download(r) {
  const f = new File(Paths.cache, "genescan-analysis.json");
  f.create({ overwrite: true });
  f.write(JSON.stringify(r, null, 2));
  await Sharing.shareAsync(f.uri);
}
function App() {
  return (
    <Boundary>
      <Workspace
        {...{ db, pick, download }}
        redirect="genescan://auth"
      />
    </Boundary>
  );
}
registerRootComponent(App);
