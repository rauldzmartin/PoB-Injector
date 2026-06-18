import subprocess
class Mock:
    def CreateProcess(self, *args, **kwargs):
        print('PATCHED!')
        raise Exception('PATCHED!')
    def __getattr__(self, name):
        return getattr(subprocess._winapi, name)
setattr(subprocess, '_winapi', Mock())
try:
    subprocess.Popen(['cmd.exe', '/c', 'echo 1'])
except Exception as e:
    print(e)
