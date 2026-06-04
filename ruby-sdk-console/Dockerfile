FROM ruby:3.3-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile ./
RUN bundle lock --add-platform ruby && bundle install

COPY . .

EXPOSE 8001

CMD ["bundle", "exec", "ruby", "app.rb"]
