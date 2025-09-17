"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const SamuraiAgentPanelWebviewViewProvider_1 = require("./webview/SamuraiAgentPanelWebviewViewProvider");
function activate(context) {
    console.log('TEST: Extension activating...');
    vscode.window.showInformationMessage('TEST: Extension is active!');
    // Register the Hello World command
    const disposable = vscode.commands.registerCommand('samurai-agent.helloWorld', () => {
        vscode.window.showInformationMessage('TEST: Hello World!');
    });
    // Register the agent panel webview provider
    const agentPanelProvider = new SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider(context.extensionUri);
    const agentPanelWebviewDisposable = vscode.window.registerWebviewViewProvider(SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider.viewType, agentPanelProvider);
    context.subscriptions.push(disposable, agentPanelWebviewDisposable);
    console.log('TEST: Command and webview provider registered');
}
function deactivate() {
    console.log('TEST: Extension deactivating...');
}
//# sourceMappingURL=extension.js.map