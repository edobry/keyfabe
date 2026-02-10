# default: list available recipes
default:
    @just --list

# run all checks (lint, test, build)
check: lint test build

# run linter
lint:
    npm run lint

# auto-fix lint issues
fix:
    npm run lint:fix

# run tests
test:
    npm run test

# run tests in watch mode
test-watch:
    npm run test:watch

# build the project
build:
    npm run build

# run the CLI in dev mode (via tsx)
dev *args:
    npm run dev -- {{args}}

# install dependencies
install:
    npm ci

# check for outdated dependencies
outdated:
    npm outdated

# clean build artifacts
clean:
    rm -rf dist

# rebuild from scratch
rebuild: clean build

# check CI status for the current branch
ci-status:
    gh run list --limit 5 --json status,conclusion,displayTitle,headBranch,url \
        --template '{{`{{range .}}{{.displayTitle}} | {{.status}} {{.conclusion}} | {{.url}}{{"\n"}}{{end}}`}}'

# watch the latest CI run
ci-watch:
    gh run watch "$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status

# show npm package info
npm-info:
    npm info keyfabe

# dry-run semantic-release to preview next version
release-dry-run:
    npx semantic-release --dry-run
