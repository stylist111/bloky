#! /bin/bash
cd webext-sdk
apt-get update && apt-get install -y make g++
# https://www.how2shout.com/linux/install-microsoft-edge-on-linux/
wget https://packages.microsoft.com/keys/microsoft.asc
cat microsoft.asc | gpg --dearmor > microsoft.gpg
install -o root -g root -m 644 microsoft.gpg /etc/apt/trusted.gpg.d/
echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge-dev.list
rm microsoft.*
apt-get update && apt-get install -y microsoft-edge-stable
npm install
npm run test-server &
export LANGUAGE=en
xvfb-run -a npm test -- v3 edge