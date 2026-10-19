package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.util.Date;
import lombok.Data;

/**
 * User Info
 */
@Data
@ApiModel("Student Info")
public class Student {

  @ApiModelProperty("primary key")
  private String userId;

  @ApiModelProperty("student name")
  private String user_name;

  @ApiModelProperty("group id")
  private String group_id;

  @ApiModelProperty("extension")
  private Date extension;
}
