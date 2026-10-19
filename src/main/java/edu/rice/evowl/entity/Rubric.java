package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("ta rubric")
public class Rubric {

  @ApiModelProperty("primary key")
  private String unique_id;

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("criteria id")
  private Long criteria_id;

  @ApiModelProperty("rubric headers")
  private String headers;

  @ApiModelProperty("deduction text")
  private String deduction_text;

  @ApiModelProperty("deduction points")
  private String deduction_pts;

  @ApiModelProperty("mutually exclusive")
  private Boolean mutually_exclusive;
}
