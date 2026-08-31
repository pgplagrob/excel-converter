

let a = "wewef";
let b = "";

function test() {
    return {"status" : false}
}

const awd = test()

console.log(awd.status)

if (awd.status) {
    console.log(true)
} else {
    console.log(false)
}