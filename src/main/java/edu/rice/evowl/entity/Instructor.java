package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("Instructor Info")
public class Instructor {

  @ApiModelProperty("primary key")
  private String userId;

  @ApiModelProperty("instructor role")
  private String role;

  @ApiModelProperty("instructor name")
  private String name;

}
