#!/usr/bin/env python3
"""Deploy panel bot to VPS over SSH (password via DEPLOY_SSH_PASSWORD env)."""
import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "147.79.67.133")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
REMOTE_DIR = "/opt/panel-search-bot"
ROOT = Path(__file__).resolve().parents[1]


def run(client, cmd, timeout=600):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode()
    err = stderr.read().decode()
    if code != 0:
        raise RuntimeError(f"cmd failed ({code}): {cmd}\n{err or out}")
    return out


def main():
    if not PASSWORD or not TOKEN:
        print("Set DEPLOY_SSH_PASSWORD and TELEGRAM_BOT_TOKEN", file=sys.stderr)
        sys.exit(1)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    print("Installing Node.js if needed...")
    run(
        client,
        "export DEBIAN_FRONTEND=noninteractive; "
        "command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && "
        "apt-get install -y nodejs)",
        timeout=900,
    )

    print("Packing project...")
    tf = tempfile.NamedTemporaryFile(suffix=".tgz", delete=False)
    tf.close()
    def tar_filter(member: tarfile.TarInfo):
        parts = member.name.split("/")
        if "node_modules" in parts:
            return None
        if member.name.endswith("user-drive-panels-source.txt"):
            return None
        return member

    with tarfile.open(tf.name, "w:gz") as tar:
        tar.add(ROOT, arcname="firebase-panel-bot", filter=tar_filter)

    remote_tar = "/tmp/panel-search-bot.tgz"
    print("Uploading...")
    sftp = client.open_sftp()
    sftp.put(tf.name, remote_tar)
    sftp.close()
    os.unlink(tf.name)

    run(client, f"rm -rf {REMOTE_DIR} /opt/firebase-panel-bot")
    run(client, f"tar xzf {remote_tar} -C /opt")
    run(client, f"test -d /opt/firebase-panel-bot && mv /opt/firebase-panel-bot {REMOTE_DIR}")
    run(client, f"test -f {REMOTE_DIR}/package.json")
    run(client, f"cd {REMOTE_DIR} && npm install --omit=dev", timeout=900)

    import base64

    env_body = f"TELEGRAM_BOT_TOKEN={TOKEN}\nBOT_DATA_DIR={REMOTE_DIR}/.bot-data\n"
    b64env = base64.b64encode(env_body.encode()).decode()
    run(
        client,
        f"echo {b64env} | base64 -d > /etc/panel-search-bot.env && chmod 600 /etc/panel-search-bot.env",
    )

    service = (ROOT / "deploy" / "panel-search-bot.service").read_text()
    b64svc = base64.b64encode(service.encode()).decode()
    run(
        client,
        f"echo {b64svc} | base64 -d > /etc/systemd/system/panel-search-bot.service",
    )
    run(client, "systemctl daemon-reload && systemctl enable panel-search-bot && systemctl restart panel-search-bot")
    out = run(client, "systemctl is-active panel-search-bot && journalctl -u panel-search-bot -n 5 --no-pager")
    print(out)
    client.close()
    print("Deploy OK:", HOST)


if __name__ == "__main__":
    main()
