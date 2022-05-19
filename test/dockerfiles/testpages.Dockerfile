# Copyright (c) 2019-present eyeo GmbH
#
# This module is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

FROM node:16

RUN apt-get update
RUN apt-get install -y wget git unzip

# Non-headless Chromium requires xvfb-run
RUN apt-get install -y libgtk-3-0 libxt6 xvfb libnss3 libxss1 libgconf-2-4 libasound2 libgbm1

# CMS and Jinja2 require Python 2.7
RUN apt-get install -y python
RUN wget https://bootstrap.pypa.io/pip/2.7/get-pip.py
RUN python get-pip.py
RUN pip install Jinja2

# Sitescripts require spawn-fcgi, python-flup and python-m2crypto
RUN apt-get install -y spawn-fcgi python-flup python-m2crypto nginx

# Clone testpages
RUN git clone https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org.git
RUN cd testpages.adblockplus.org && npm install

# nginx config
ENV DOMAIN=local.testpages.adblockplus.org
RUN cp -r testpages.adblockplus.org/test/etc/* /etc
RUN rm /etc/nginx/sites-enabled/default
RUN rm /etc/nginx/sites-available/default
RUN cd /etc/nginx && openssl req -x509 -newkey rsa:4096 \
  -keyout ${DOMAIN}_key.pem \
  -out ${DOMAIN}_cert.pem \
  -days 365 -nodes -subj '/CN=$DOMAIN'

# spawn-fcgi config
RUN touch /var/run/500-multiplexer_spawn-fcgi.pid

# Build sitescripts
RUN git clone https://gitlab.com/eyeo/devops/legacy/sitescripts.git
RUN cd sitescripts && git checkout 98b8bc35

# Build CMS
RUN git clone https://github.com/adblockplus/cms.git
RUN pip install -r cms/requirements.txt

# Build tests
RUN cd testpages.adblockplus.org && npm install

# Generate test pages files
ENV SITE_URL=https://$DOMAIN:5000
RUN mkdir -p /var/www/$DOMAIN
RUN PYTHONPATH=cms python -m cms.bin.generate_static_pages testpages.adblockplus.org /var/www/$DOMAIN

# Build custom extension
# enable unsafe-perm to avoid problems with running npm as root
# see https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/193
RUN export npm_config_unsafe_perm=true

# Update git version to fix problems with ls-files command
# https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1040
RUN echo "deb http://deb.debian.org/debian stretch-backports main" > /etc/apt/sources.list.d/stretch-backports.list
RUN apt-get update
RUN apt-get -t stretch-backports install -y git

# Clone ABPUI
RUN git clone -b 3.13 https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui.git
# Update dependencies
RUN cd adblockplusui && npm run submodules:update && git submodule status && npm install
# Create extension builds
RUN cd adblockplusui/vendor && rm -rf webext-sdk
RUN mkdir adblockplusui/vendor/webext-sdk
COPY . adblockplusui/vendor/webext-sdk
RUN cd adblockplusui/vendor/webext-sdk && npm install
RUN cd adblockplusui/adblockpluschrome \
 && npx gulp build -t chrome -c development
RUN mv adblockplusui/adblockpluschrome/adblockpluschrome-*.zip /adblockpluschrome.zip
# Unpack custom extension
RUN  unzip -q adblockpluschrome.zip -d testpages.adblockplus.org/testext;
ENV BROWSER="Firefox \(latest\)"
ENV TESTS_SUBSET=""
ENV SKIP_EXTENSION_DOWNLOAD="true"
# Skipping circumvention because EWE 0.4.0 has a bug: https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1124
ENV TESTS_EXCLUDE="Snippets"
ENTRYPOINT /testpages.adblockplus.org/test/entrypoint.sh
