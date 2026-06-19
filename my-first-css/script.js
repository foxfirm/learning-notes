
$(document).ready(function () {
    //console.log('query is ready');
});

function clickHandler() {
    let h = document.documentElement.clientHeight;
    let w = document.documentElement.clientWidth;
    console.log(`当前窗口的宽度为 ${w}px，高度为 ${h}px`);
    let docu = document.documentElement;
    console.log(`window.pageYOffset: ${window.pageYOffset}`); // 当前页面在垂直方向上滚动的距离
    console.log(`window.pageXOffset: ${window.pageXOffset}`); // 当前页面在水平方向上滚动的距离
}

window.clickHandler = clickHandler; // 将函数暴露到全局作用域，以便在 HTML 中调用

