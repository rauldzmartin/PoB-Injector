import atexit
import os
import re
import sys
from typing import *

import importlib.resources
from win32com.shell import shell, shellcon  # type: ignore

from .process_wrapper import ProcessWrapper, safe_string

HTML_ITEM_HEADER = r'''<html><head>
<style>
html {
    background: black;
    color: antiquewhite;
    font-family: "FontinSmallCaps",Verdana,Arial,Helvetica,sans-serif;
    line-height: 1.3;
}
.results {
    font-family: sans-serif;
}
.option > .hdr1 {
    padding-top: 1em;
    display: block;
}
</style>
</head><body>
'''


class ExternalError(Exception):

    def __init__(self, status):
        self.status = status
        super().__init__()


_stat_pattern = re.compile(
    r'^([+-])([\d.,]+%?)([a-zA-Z]*)\s+(.+?)(?:\s+\(([+-][\d.,]+%)\))?$'
)


def _parse_stat_value(s):
    s = s.rstrip('%')
    s = s.replace(',', '')  # Remove thousands separator
    try:
        return float(s)
    except ValueError:
        return 0.0


def _num_string(value):
    return f'{value:.10g}'


def _pob_line_to_html(line):
    line = re.sub(r'\^8', r'^x888888', line)  # ^8 is grey

    clean = re.sub(r'\^x[0-9A-F]{6}|\^[78]', '', line)

    line = re.sub(r'\^x([0-9A-F]{6})(.*?)(?=$|\^)', r'<span style="color:#\1">\2</span>', line, re.MULTILINE)
    line = re.sub(r'\^7', r'', line)  # ^7 resets to default
    if line == '----':
        return '<hr/>'

    m = _stat_pattern.match(clean)
    if m:
        sign, raw_num, suffix, stat_name, percentage_str = m.groups()
        abs_val = _parse_stat_value(raw_num)
        num_val = -abs_val if sign == '-' else abs_val

        _DPS_ICONS = {
            'ignite': '⚔️🔥',
            'bleed':  '⚔️🩸',
            'poison': '⚔️☠️',
        }
        display_name = stat_name
        title_attr = ''
        if "Total DPS inc." in stat_name:
            suffix_part = stat_name[len("Total DPS"):].strip()  # e.g. "inc. Ignite"
            ailment_key = suffix_part.lower().split()[-1]       # last word: ignite/bleed/poison
            icon = _DPS_ICONS.get(ailment_key, '⚔️')
            line = line.replace(stat_name, "Total DPS")
            line += f" {icon}"
            title_attr = f' title="{suffix_part}"'
        elif "Effective Hit Pool" in stat_name:
            line += " ❤️"

        return f'<div data-stat="{stat_name}"{title_attr} data-value="{num_val}">{line}</div>'

    return f'<div>{line}</div>'


def _mark_item_groups(output):
    hr_pos = output.rfind('<hr/>')
    # output = f'<div class="item">\n{output[:hr_pos]}</div>\n<hr/>\n<div class="results">\n{output[hr_pos + 6:]}\n</div>'
    # Only send the results back for rendering
    output = f'<div class="results">\n{output[hr_pos + 6:]}\n</div>'

    output = re.sub(r'\n(?:<div>)((?:Equipping|Removing) this item.+:)\n(\(.+\))</div>((?:\n.*</div>)+)',
                    r'\n<div class="option" data-sort="\1">\n<div class="hdr1">\1</div>\n<div class="hdr2">\2</div>\n<br>\3\n</div><!-- END_OPTION -->\n', output)
    output = re.sub(r'\n<hr/>\n<hr/>', r'\n<hr/>', output)

    options = re.findall(r'\n<div class="option" data-sort=".*?">.*?<!-- END_OPTION -->\n', output, flags=re.DOTALL)
    if options:
        options.sort(key=lambda opt: re.search(r'data-sort="(.*?)"', opt).group(1) if re.search(r'data-sort="(.*?)"', opt) else opt)
        for i in range(1, len(options)):
            options[i] = '<br>' + options[i]
        output = re.sub(r'\n<div class="option" data-sort=".*?">.*?<!-- END_OPTION -->\n', lambda m: options.pop(0), output, flags=re.DOTALL)
    return output


def _calculate_diff(base_values, new_values):
    fields = set(base_values.keys()) | set(new_values.keys())
    changes = dict()
    for field in fields:
        base_value = base_values.get(field, 0)
        new_value = new_values.get(field, 0)
        if not isinstance(new_value, type(base_value)):
            continue
        if base_value == new_value:  # exactly the same
            continue
        if _num_string(base_value) == _num_string(new_value):  # the same to 10 significant figures
            continue
        changes[field] = float(_num_string(new_value - base_value))
    return changes




class PathOfBuilding:

    def __init__(self, pob_path, pob_install, verbose=False):
        self.verbose = verbose and True
        if getattr(sys, 'frozen', False):
            data_dir = os.path.join(sys._MEIPASS, 'pob_wrapper', 'data')
        else:
            data_dir = importlib.resources.files('pob_wrapper').joinpath('data')
            
        docs = shell.SHGetFolderPath(0, shellcon.CSIDL_PERSONAL, None, 0)

        lua_path_parts = [
            f'{data_dir}\\?.lua;{pob_path}\\lua\\?.lua',
            f'{pob_install}\\lua\\?.lua',
            f'{pob_install}\\lua\\?\\init.lua',
        ]
        if pob_path != pob_install:
            lua_path_parts.append(f'{pob_path}\\lua\\?.lua')
            lua_path_parts.append(f'{pob_path}\\lua\\?\\init.lua')

        os.environ['LUA_PATH']  = ';'.join(lua_path_parts) + ';;'
        os.environ['LUA_CPATH'] = ';'.join([
        
            f'{pob_install}\\?.dll',
            f'{pob_install}\\?.lua',
            f'{pob_install}\\bin\\?.dll',
            f'{pob_install}\\lib\\?.dll',
            f'{pob_install}\\Modules\\?.lua',
            f'{pob_install}\\Data\\?.lua',
            f'{pob_install}\\Classes\\?.lua',
            
        ]) + ';;'

        os.environ['POB_USERPATH'] = docs
        os.environ['POB_SCRIPTPATH'] = pob_path
        os.environ['POB_RUNTIMEPATH'] = pob_install
        
        # FIX: PyInstaller puts its temp folder at the start of PATH, which can contain conflicting DLLs 
        # (like zlib1.dll) that break lcurl.dll. Force pob_install to the absolute front of PATH.
        os.environ['PATH'] = f"{pob_install}{os.pathsep}{os.environ.get('PATH', '')}"
        
        print("DEBUG: data_dir =", data_dir)
        print("DEBUG: luajit path =", os.path.join(data_dir, 'luajit.exe'))
        print("DEBUG: cli.lua path =", os.path.join(data_dir, 'cli.lua'))
        if getattr(sys, 'frozen', False):
            try:
                files = [f.name for f in os.scandir(data_dir)]
                print("DEBUG: files in data_dir =", sorted(files))
            except Exception as e:
                print("DEBUG: failed to list data_dir:", e)
        print("DEBUG: cwd =", pob_path)

        self.pob = ProcessWrapper(debug=self.verbose)  #  Initialize first

        firstline = self.pob.start([f'{data_dir}\\luajit.exe', f'{data_dir}\\cli.lua'], cwd=pob_path)

        if firstline != 'LUA: Started\n':
            # Read remaining output from the process
            try:
                output_lines = []
                while True:
                    line = self.pob.get()
                    output_lines.append(line)
            except EOFError:
                pass

            output_text = '\n'.join(output_lines)
            raise ChildProcessError(f"Lua did not start correctly.\nOutput:\n{output_text}")

        atexit.register(self.kill)

    def require(self, module):
        '''Load the specified Lua module.'''
        module = safe_string(module)
        self._send(f'require("{module}")', ignore_result=True)

    def get_builds_dir(self):
        return self._send('getBuildsDir()')

    def load_build(self, path: str):
        path = safe_string(path)
        self._send(f'loadBuild("{path}")', ignore_result=True)

    def update_build(self):
        self._send(f'updateBuild()', ignore_result=True)

    def get_build_info(self):
        result = self._send(f'getBuildInfo()')
        return result

    def import_item(self, item_text, max_quality=False):
        '''Import an item into the current build's item list without equipping.'''
        item_text = safe_string(item_text)
        mq_str = "true" if max_quality else "false"
        result = self._send(f'importItem("{item_text}", {mq_str})')
        return result

    def test_item_as_html(self, item_text, max_quality=False):
        '''Run the item through the tester, returning an HTML representation of the effects.'''
        item_text = safe_string(item_text)
        mq_str = "true" if max_quality else "false"
        lines = self._send(f'testItemForDisplay("{item_text}", {mq_str})')

        if not lines:
            return {"html": "", "unsupported": []}

        unsupported_lines = []
        for line in lines:
            if '(Not supported in PoB yet)' in line:
                clean_line = re.sub(r'\^x[0-9A-Fa-f]{6}|\^[0-9]', '', line)
                clean_line = clean_line.replace('(Not supported in PoB yet)', '').strip()
                unsupported_lines.append(clean_line)

        # Convert the output to HTML
        html_lines = [_pob_line_to_html(line) for line in lines if line]
        output = '\n'.join(html_lines)
        output = _mark_item_groups(output)

        return {"html": HTML_ITEM_HEADER + output, "unsupported": unsupported_lines}

    # # Not currently possible without evaluating all possible slots
    # def test_item_effect(self, item_text):
    #     '''Run the item through the tester, returning the stat diffs.'''
    #     item_text = safe_string(item_text)
    #     result = self._send(f'testItemStats("{item_text}")')
    #     changes = _calculate_diff(result['base'], result['new'])
    #     return changes

    def test_mod_effect(self, mod_line):
        '''Evaluate the effect of the given mod line, returning the stat diffs.'''
        mod_line = safe_string(mod_line)
        result = self._send(f'findModEffect("{mod_line}")')
        changes = _calculate_diff(result['base'], result['new'])
        return changes

    def echo(self, msg: str):
        msg = safe_string(msg)
        self._send(f'echo_message("{msg}")')

    def error(self, msg: str):
        msg = safe_string(msg)
        self._send(f'echo_error("{msg}")')

    def fetch(self, msg: str):
        '''Warning: msg must be valid Lua format'''
        result = self._send(f'echo_result({msg})')
        return result

    def _send(self, line, ignore_result=False) -> Any:
        if not self.pob:
            raise BrokenPipeError('POB is already disposed')

        result = self.pob.send(line, ignore_result=ignore_result)
        if ignore_result or result is True:
            return True
        if not result or result['status'] != 'success':
            raise ExternalError(result)
        return result.get('result', None)

    direct_send = _send

    def kill(self):
        if self.pob:
            self.pob.kill()
            self.pob = None

        atexit.unregister(self.kill)
