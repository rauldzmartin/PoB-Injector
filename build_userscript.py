import os
import json
import base64

def main():
    here = os.path.abspath(os.path.dirname(__file__))
    ext_dir = os.path.join(here, "extension")
    manifest_path = os.path.join(ext_dir, "manifest.json")
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    version = manifest.get("version", "1.0.0")
    
    # Read CSS files
    css_content = ""
    for css_file in ["style.css", "trade.css"]:
        css_path = os.path.join(ext_dir, "css", css_file)
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content += f.read() + "\n"
    
    css_content = css_content.replace("`", "\\`")
        
    # Read JS files
    js_path = os.path.join(ext_dir, "js", "trade.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js_content = f.read()
        
    injected_js_path = os.path.join(ext_dir, "js", "trade-injected.js")
    with open(injected_js_path, "r", encoding="utf-8") as f:
        injected_js_content = f.read()

    # Base64 encode icon (optional, could just use a remote URL or empty data URL)
    icon_path = os.path.join(ext_dir, "img", "icon.png")
    icon_b64 = ""
    if os.path.exists(icon_path):
        with open(icon_path, "rb") as f:
            icon_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")

    # Replace chrome.runtime calls in trade.js to make it Tampermonkey compatible
    js_content = js_content.replace(
        "script.src = chrome.runtime.getURL('js/trade-injected.js');",
        "script.textContent = `" + injected_js_content.replace("`", "\\`").replace("${", "\\${") + "`;"
    )
    js_content = js_content.replace("chrome.runtime.getURL('img/icon.png')", f"'{icon_b64}'")
    js_content = js_content.replace("chrome.runtime.getManifest()", f"({{ version: '{version}' }})")
    js_content = js_content.replace("chrome.runtime.sendMessage({action: 'reload_extension'});", "window.location.reload();")

    # Mock chrome object if it doesn't exist to prevent undefined errors
    mock_chrome = """
    if (typeof chrome === 'undefined') {
        window.chrome = {
            runtime: {
                getURL: (path) => '',
                getManifest: () => ({ version: '""" + version + """' }),
                sendMessage: () => {}
            }
        };
    }
    """

    repo_url = "https://raw.githubusercontent.com/rauldzmartin/PoB-Injector/main/pob-injector.user.js"

    userscript = f"""// ==UserScript==
// @name         PoB Injector
// @namespace    http://tampermonkey.net/
// @version      {version}
// @description  Inline PoB impact for trade/trade2 via local FastAPI HTTP server
// @author       Raul DZ Martin
// @match        *://*.pathofexile.com/trade*
// @grant        none
// @updateURL    {repo_url}
// @downloadURL  {repo_url}
// ==/UserScript==

(function() {{
    'use strict';
{mock_chrome}

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `{css_content}`;
    document.head.appendChild(style);

    // Inject Main JS
{js_content}
}})();
"""

    out_dir = os.path.join(here, "dist")
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    out_path = os.path.join(out_dir, "pob-injector.user.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(userscript)
        
    print(f"UserScript built successfully: pob-injector.user.js (v{version})")

if __name__ == "__main__":
    main()
