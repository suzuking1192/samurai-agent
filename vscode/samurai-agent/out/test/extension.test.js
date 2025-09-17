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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const SamuraiAgentPanelWebviewViewProvider_1 = require("../webview/SamuraiAgentPanelWebviewViewProvider");
suite('Samurai Agent Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('SamuraiAgentPanelWebviewViewProvider should have correct viewType', () => {
        assert.strictEqual(SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider.viewType, 'samurai-agent.agentPanel', 'ViewType should be samurai-agent.agentPanel');
    });
    test('SamuraiAgentPanelWebviewViewProvider should be instantiable', () => {
        const mockExtensionUri = vscode.Uri.file('/mock/path');
        const provider = new SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
        assert.ok(provider, 'Provider should be instantiable');
    });
    test('SamuraiAgentPanelWebviewViewProvider should generate HTML with multi-tabbed layout', () => {
        const mockExtensionUri = vscode.Uri.file('/mock/path');
        const provider = new SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
        // Create a mock webview
        const mockWebview = {
            asWebviewUri: (uri) => uri.toString(),
            options: {}
        };
        // Access the private method for testing
        const html = provider._getHtmlForWebview(mockWebview);
        // Verify the HTML contains the expected multi-tabbed structure
        assert.ok(html.includes('agent-panel-container'), 'HTML should contain agent-panel-container');
        assert.ok(html.includes('tab-header'), 'HTML should contain tab-header');
        assert.ok(html.includes('chat-tab'), 'HTML should contain chat-tab');
        assert.ok(html.includes('task-tab'), 'HTML should contain task-tab');
        assert.ok(html.includes('setting-tab'), 'HTML should contain setting-tab');
        assert.ok(html.includes('chat-content'), 'HTML should contain chat-content');
        assert.ok(html.includes('task-content'), 'HTML should contain task-content');
        assert.ok(html.includes('setting-content'), 'HTML should contain setting-content');
        assert.ok(html.includes('agentPanel.css'), 'HTML should include agentPanel.css');
        assert.ok(html.includes('agentPanel.js'), 'HTML should include agentPanel.js');
        assert.ok(html.includes('chat.css'), 'HTML should include chat.css');
        assert.ok(html.includes('chat.js'), 'HTML should include chat.js');
    });
    test('HTML should contain proper tab labels', () => {
        const mockExtensionUri = vscode.Uri.file('/mock/path');
        const provider = new SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
        const mockWebview = {
            asWebviewUri: (uri) => uri.toString(),
            options: {}
        };
        const html = provider._getHtmlForWebview(mockWebview);
        // Verify tab labels are present
        assert.ok(html.includes('>Chat<'), 'HTML should contain Chat tab label');
        assert.ok(html.includes('>Task<'), 'HTML should contain Task tab label');
        assert.ok(html.includes('>Setting<'), 'HTML should contain Setting tab label');
    });
});
//# sourceMappingURL=extension.test.js.map