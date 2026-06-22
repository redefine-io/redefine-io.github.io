# redefine.io website

- legacy website `main` brach
- LIVE branch `web`, source https://github.com/redefine-io/website


# LEGACY website

```bash
docker build . -t website
docker run --rm -it -p3000:4321 -v$(pwd):/app -v/app/node_modules -v/app/dist website
# NOTE: `-v/app/node_modules` `-v/app/dist` are used to ignore your local
#       `node_modules` and `dist` directories.
```

Then open your browser at: http://localhost:3000/
