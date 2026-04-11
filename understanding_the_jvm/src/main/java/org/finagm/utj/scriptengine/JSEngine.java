package org.finagm.utj.scriptengine;

import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;

/**
 * JSEngine
 *
 * @author huligang
 * @since 2026-04-05
 */
public class JSEngine {

    public static void main(String[] args) {
        ScriptEngineManager manager = new ScriptEngineManager();
        ScriptEngine engine = manager.getEngineByName("graal.js");
        if (engine == null) {
            System.err.println("无法找到 JavaScript 引擎，请确保已添加 GraalJS 依赖");
            return;
        }
        try {
            engine.eval("print('hello world')");

            engine.eval("function add(a, b) {return a + b;}");
            Invocable invocable = (Invocable) engine;
            Object result = invocable.invokeFunction("add", 1, 2);
            System.out.println("result from js: " + result);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
