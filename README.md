# gopher
A Gopher server, as described in RFC 1436.

## Running
Running the server is pretty simple. You'll need a directory
of files that you would like to serve. That directory needs to contain a
special file called `index.json`. Your `index.json` file is used by the server
to send server contents to the client.

Here's an example `index.json`:
```
{
    "entries": [
        {
            "type": 0,
            "display": "Welcome",
            "selector": "Welcome",
            "server": "blog.kkantor.com",
            "port": 70
        },
        {
            "type": 1,
            "display": "2017",
            "selector": "2017/",
            "server": "blog.kkantor.com",
            "port": 70
        }
    ]

}
```
This `index.json` describes a directory that has two items publicly accessible.
The first is a file called `Welcome`, and the second is a directory called
`2017`. The directory `2017` must also contain an `index.json` file describing
its contents.

```
$ npm install
$ node server.js <directory containing files to serve>
```

## Connecting
Use `telnet`! Here's an example run:
```
$ telnet 127.0.0.1 70
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
/* The user presses 'enter' to send a CR-LF */

0    Welcome Welcome  blog.kkantor.com    70
1    2017    2017/    blog.kkantor.com    70

.Connection to 127.0.0.1 closed by foreign host.
```
