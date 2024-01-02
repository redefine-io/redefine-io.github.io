# Redefine Technologies

```bash
docker build . -t website
docker run --rm -it -p3000:3000 -v$(pwd):/app -v/app/node_modules -v/app/dist website
# NOTE: `-v/app/node_modules` `-v/app/dist` are used to ignore your local
#       `node_modules` and `dist` directories.
```

Then open your browser at: http://localhost:3000/

