package edu.rice.evowl.util;

public class AjaxResult {

  public Integer code;

  public String msg;

  public Object data;

  public static AjaxResult success(Object obj) {
    AjaxResult result = new AjaxResult();

    result.code = 0;
    result.msg = "success";
    result.data = obj;

    return result;
  }

  public static AjaxResult error(Object obj) {
    AjaxResult result = new AjaxResult();

    result.code = 0;
    result.msg = "error";
    result.data = obj;

    return result;
  }
}
