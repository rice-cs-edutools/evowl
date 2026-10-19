package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("Submission")
public class Submission {

  @ApiModelProperty("primary key")
  private String submission_id;

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("assignment name")
  private String assignment_name;

  @ApiModelProperty("group id")
  private String group_id;

  @ApiModelProperty("submission path")
  private String submission_path;
}
